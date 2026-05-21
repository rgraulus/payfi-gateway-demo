#!/usr/bin/env ts-node
/**
 * Phase 3 proof shape checker.
 *
 * Safety-first skeleton for local Buyer Wallet proof verification work.
 *
 * By default, this script does NOT perform live Concordium verification.
 * Live verification is attempted only when explicitly enabled with
 * --live-verify or PHASE3_LIVE_VERIFY=true.
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

Optional live verification attempt:
  ts-node scripts/phase3-proof-shape-check.ts --proof /private/local/buyer-proof.raw.json --live-verify

Live verification envs:
  PHASE3_LIVE_VERIFY=true
  PHASE3_GRPC_HOST=127.0.0.1
  PHASE3_GRPC_PORT=20001
  PHASE3_NETWORK=testnet

Purpose:
  Parse and classify a local Buyer Wallet proof artifact without printing raw proof material.

Safety:
  - Raw wallet proof material must not be committed.
  - This script refuses the repo sanitized fixture.
  - This script prints safe shape metadata only.
  - This script performs live gRPC verification only when explicitly enabled.
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

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

function shouldAttemptLiveVerify(args: Args): boolean {
  return args["live-verify"] === true || envFlag("PHASE3_LIVE_VERIFY");
}

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function unwrapPresentationForVerification(json: unknown, family: ArtifactFamily): Record<string, unknown> | undefined {
  const root = asRecord(json);
  if (!root) return undefined;

  if (family === "phase3_harness_capture_wrapper") {
    return asRecord(root.presentation);
  }

  if (family === "verifiable_presentation") {
    return root;
  }

  return undefined;
}

function safeError(err: unknown): string {
  const msg = String((err as any)?.message ?? err);
  return msg.length > 500 ? msg.slice(0, 500) + "..." : msg;
}

async function attemptLiveVerification(json: unknown, family: ArtifactFamily) {
  const presentationJson = unwrapPresentationForVerification(json, family);

  if (!presentationJson) {
    return {
      ok: false,
      stage: "unsupported_artifact_family",
      family,
      reason: "Live verification currently supports current VerifiablePresentation artifacts only.",
      rawProofPrinted: false,
    };
  }

  const grpcHost = process.env.PHASE3_GRPC_HOST ?? "127.0.0.1";
  const grpcPort = getEnvInt("PHASE3_GRPC_PORT", 20001);
  const network = process.env.PHASE3_NETWORK ?? "testnet";

  try {
    const grpcMod: any = await import("@concordium/web-sdk/nodejs");
    const sdkMod: any = await import("@concordium/web-sdk");
    const web3IdMod: any = await import("@concordium/web-sdk/web3-id");
    const wasmMod: any = await import("@concordium/web-sdk/wasm");

    const grpc = new grpcMod.ConcordiumGRPCNodeClient(
      grpcHost,
      grpcPort,
      grpcMod.credentials.createInsecure()
    );

    const presentation = sdkMod.VerifiablePresentation.fromString(
      JSON.stringify(presentationJson)
    );

    const credentialMetadata = await web3IdMod.getPublicData(
      grpc,
      network,
      presentation
    );

    const publicData = credentialMetadata.map((x: any) => x.inputs);
    const cryptographicParameters = await grpc.getCryptographicParameters();

    const verifiedRequest = wasmMod.verifyPresentation(
      presentation,
      cryptographicParameters,
      publicData
    );

    return {
      ok: true,
      stage: "verified",
      network,
      grpcHost,
      grpcPort,
      credentialCount: credentialMetadata.length,
      verifiedRequestKeys: safeKeys(verifiedRequest),
      rawProofPrinted: false,
    };
  } catch (err) {
    return {
      ok: false,
      stage: "verification_failed",
      network,
      grpcHost,
      grpcPort,
      reason: safeError(err),
      rawProofPrinted: false,
    };
  }
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
    liveVerification: null as unknown,
    nextStep:
      "Run again with --live-verify or PHASE3_LIVE_VERIFY=true to fetch public data and call verifyPresentation(...).",
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

  let liveVerificationFailed = false;

  if (shouldAttemptLiveVerify(args)) {
    summary.liveVerificationAttempted = true;
    summary.liveVerification = await attemptLiveVerification(json, family);
    liveVerificationFailed =
      Boolean(asRecord(summary.liveVerification)) &&
      asRecord(summary.liveVerification)?.ok !== true;
  }

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (family === "unknown" || liveVerificationFailed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`ERROR: ${String((err as any)?.message ?? err)}`);
  process.exit(1);
});
