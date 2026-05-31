#!/usr/bin/env ts-node
/**
 * Phase 3 private-proof verifier harness.
 *
 * This script validates the PR #93 verifier adapter against a local,
 * uncommitted Buyer Wallet proof artifact.
 *
 * Safety:
 * - Does not commit or persist raw proof material.
 * - Does not print raw proof/presentation fields.
 * - Refuses repo sanitized fixture paths.
 * - Does not touch Gateway enforcement, CRP, payment, or replay logic.
 * - Live verification is opt-in only with --live or PHASE3_LIVE_VERIFY=true.
 */

import { existsSync, readFileSync } from 'node:fs';
import { normalize, relative, resolve } from 'node:path';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import { verifyConcordiumZkpAuthorizationEnvelope } from '../src/phase3/concordiumZkpVerifier';

type Args = Record<string, string | boolean>;

type PrivateProofFamily =
  | 'phase3_harness_capture_wrapper'
  | 'verifiable_presentation'
  | 'verifiable_presentation_v1'
  | 'sanitized_sample_refused'
  | 'unknown';

function usage(exitCode = 0): never {
  const msg = `
Usage:
  PHASE3_BUYER_PROOF_PATH=/private/local/buyer-proof.raw.json npm run phase3:private-proof-test

Or:
  npm run phase3:private-proof-test -- --proof /private/local/buyer-proof.raw.json

Optional live verification:
  PHASE3_BUYER_PROOF_PATH=/private/local/buyer-proof.raw.json \\
  PHASE3_GRPC_HOST=127.0.0.1 \\
  PHASE3_GRPC_PORT=20001 \\
  PHASE3_NETWORK=testnet \\
  npm run phase3:private-proof-test -- --live

Purpose:
  Safely wrap a local uncommitted Buyer Wallet proof artifact into a direct Buyer
  authorization envelope and invoke the PR #93 verifier adapter.

Safety:
  - Raw proof material must not be committed.
  - Raw proof material is not printed.
  - Repo sanitized fixtures are refused.
  - Gateway enforcement is not touched.
  - CRP/payment/replay behavior is not touched.
  - Live verification is attempted only when explicitly enabled.
`;
  console.error(msg.trim() + '\n');
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;

    const key = a.slice(2);
    if (key === 'help') {
      out.help = true;
      continue;
    }

    const v = argv[i + 1];
    if (!v || v.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = v;
      i++;
    }
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function safeKeys(value: unknown): string[] {
  return Object.keys(asRecord(value) ?? {}).sort();
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function shouldLiveVerify(args: Args): boolean {
  return args.live === true || envFlag('PHASE3_LIVE_VERIFY');
}

function isRepoSanitizedFixture(absPath: string): boolean {
  const rel = normalize(relative(process.cwd(), absPath)).replace(/\\/g, '/');
  return (
    rel === 'fixtures/concordium-zkp/phase3-buyer-proof.sample.json' ||
    rel.endsWith('/fixtures/concordium-zkp/phase3-buyer-proof.sample.json')
  );
}

function classifyPrivateProof(json: unknown): PrivateProofFamily {
  const root = asRecord(json);
  if (!root) return 'unknown';

  if (
    root.type === 'phase3_buyer_wallet_proof_sample' ||
    root.sanitized === true ||
    root.doNotUseForVerification === true
  ) {
    return 'sanitized_sample_refused';
  }

  if (
    root.type === 'phase3b_browser_wallet_presentation_capture' &&
    asRecord(root.presentation)
  ) {
    return 'phase3_harness_capture_wrapper';
  }

  const type = root.type;

  if (
    Array.isArray(type) &&
    type.includes('VerifiablePresentation') &&
    type.includes('ConcordiumVerifiablePresentationV1')
  ) {
    return 'verifiable_presentation_v1';
  }

  if (
    typeof root.presentationContext === 'string' &&
    asRecord(root.proof) &&
    Array.isArray(root.verifiableCredential)
  ) {
    return 'verifiable_presentation';
  }

  return 'unknown';
}

function unwrapPresentation(json: unknown, family: PrivateProofFamily): Record<string, unknown> | undefined {
  const root = asRecord(json);
  if (!root) return undefined;

  if (family === 'phase3_harness_capture_wrapper') {
    return asRecord(root.presentation);
  }

  if (family === 'verifiable_presentation') {
    return root;
  }

  return undefined;
}

function extractWalletMetadata(json: unknown): Record<string, string | null> {
  const root = asRecord(json) ?? {};

  return {
    network: typeof root.network === 'string' ? root.network : null,
    selectedChain: typeof root.selectedChain === 'string' ? root.selectedChain : null,
    accountAddress:
      typeof root.accountAddress === 'string'
        ? root.accountAddress
        : typeof root.address === 'string'
          ? root.address
          : null,
  };
}

function buildHarnessChallenge(): {
  challenge: ReturnType<typeof buildX402ZkpChallenge>;
  challengeHash: string;
} {
  const issuedAt = 1779289373;
  const input: BuildX402ZkpChallengeInput = {
    merchantId: 'demo-merchant',
    resource: {
      method: 'GET',
      path: '/paid-gated',
    },
    contract: {
      contractId: 'cid_demo_phase3_private_proof_harness',
      contractVersion: '1.0.0',
      isFrozen: true,
    },
    network: 'concordium:testnet',
    chain_id: 'ccd:testnet-genesis-hash-placeholder',
    caip2ChainId: null,
    asset: {
      type: 'PLT',
      tokenId: 'EUDemo',
      decimals: 6,
    },
    amount: '0.050101',
    amountMinor: '50101',
    payTo: 'ccd1qmerchantplaceholder',
    nonce: 'phase3-private-proof-harness-nonce-001',
    issuedAt,
    expiresAt: issuedAt + 1800,
    policy: {
      policyId: 'age-region-v1',
      policyVersion: '1.0.0',
      requirementsHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    businessTerms: {
      termsId: null,
      termsVersion: null,
      termsHash: null,
    },
  };

  const challenge = buildX402ZkpChallenge(input);
  const challengeHash = hashX402ZkpChallenge(challenge);
  return { challenge, challengeHash };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const proofArg =
    typeof args.proof === 'string' ? args.proof : process.env.PHASE3_BUYER_PROOF_PATH;

  if (!proofArg) {
    console.error('ERROR: missing --proof or PHASE3_BUYER_PROOF_PATH');
    usage(2);
  }

  const proofPath = resolve(proofArg);

  if (!existsSync(proofPath)) {
    console.error('ERROR: proof file not found: ' + proofPath);
    process.exit(2);
  }

  if (isRepoSanitizedFixture(proofPath)) {
    console.error(
      'ERROR: refusing to inspect repo sanitized fixture. Provide a local uncommitted raw proof file path instead.',
    );
    process.exit(2);
  }

  const raw = readFileSync(proofPath, 'utf8');
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error('ERROR: invalid JSON: ' + String((err as any)?.message ?? err));
    process.exit(2);
  }

  const family = classifyPrivateProof(json);

  if (family === 'sanitized_sample_refused') {
    console.error('ERROR: refusing sanitized sample proof artifact.');
    process.exit(2);
  }

  const presentation = unwrapPresentation(json, family);

  if (!presentation) {
    console.error('ERROR: unsupported proof artifact family: ' + family);
    process.exit(2);
  }

  const { challenge, challengeHash } = buildHarnessChallenge();
  const wallet = extractWalletMetadata(json);
  const liveVerificationAttempted = shouldLiveVerify(args);

  const envelope = {
    type: 'xcf.concordium.authorization.direct-buyer.v1',
    challenge,
    challengeHash,
    proofType: 'concordium.VerifiablePresentation',
    presentation,
    wallet,
    submittedAt: new Date().toISOString(),
  };

  const result = await verifyConcordiumZkpAuthorizationEnvelope(envelope, {
    liveVerify: liveVerificationAttempted,
    grpcHost: process.env.PHASE3_GRPC_HOST ?? '127.0.0.1',
    grpcPort: getEnvInt('PHASE3_GRPC_PORT', 20001),
    network: process.env.PHASE3_NETWORK ?? 'testnet',
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        stage: result.stage,
        privateProofRead: true,
        family,
        proofPath,
        rootKeys: safeKeys(json),
        presentationKeys: safeKeys(presentation),
        envelopeType: result.envelopeType,
        challengeHash: result.challengeHash,
        proofType: result.proofType,
        credentialCount: result.credentialCount ?? null,
        verifiedRequestKeys: result.verifiedRequestKeys ?? [],
        liveVerificationAttempted,
        agentRegistryLookupAttempted: result.agentRegistryLookupAttempted,
        delegatedAgentVerificationSupported: result.delegatedAgentVerificationSupported,
        rawProofPrinted: false,
        reason: result.ok ? null : result.reason ?? null,
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
    process.exit(liveVerificationAttempted ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(String((err as any)?.message ?? err));
  process.exit(1);
});
