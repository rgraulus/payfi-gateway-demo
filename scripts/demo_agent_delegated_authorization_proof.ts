#!/usr/bin/env node
/**
 * Build a controlled Phase 5 agent-delegated authorization request.
 *
 * This helper binds the canonical Phase 5 envelope to a runtime
 * PAYMENT-REQUIRED challenge. It does not perform cryptographic delegation
 * verification, Agent Registry lookup, Gateway calls, CRP calls, payment,
 * receipt handling, or resource release.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
} from "../src/phase3/zkpChallenge";
import {
  amountToRawUnits,
} from "../src/proofPayload";
import {
  PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
} from "../src/phase5/agentDelegationVerifier";
import {
  PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
  PHASE5_AGENT_RUNTIME_MAX_USES,
  PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
} from "../src/phase5/agentRuntimeAuthorization";

type Args = {
  paymentRequiredPath?: string;
  outPath?: string;
  region?: string;
  ageOver?: number;
  agentId?: string;
  buyerCommitment?: string;
  buyerAccount?: string;
  policySubject?: string;
  delegationId?: string;
  help?: boolean;
};

type JsonRecord = Record<string, unknown>;

function usage(): string {
  return [
    "Usage:",
    "  ts-node --transpile-only scripts/demo_agent_delegated_authorization_proof.ts \\",
    "    --payment-required <gated-pr.json> \\",
    "    --out <agent-delegated-auth.json> \\",
    "    --region <EU|US> \\",
    "    --age-over <number> \\",
    "    [--agent-id <agent-id>] \\",
    "    [--buyer-commitment <commitment>] \\",
    "    [--buyer-account <account>] \\",
    "    [--policy-subject <subject>] \\",
    "    [--delegation-id <delegation-id>]",
    "",
    "Writes a /paid-gated/redeem body containing the canonical Phase 5",
    "agent-delegated authorizationProof bound to PAYMENT-REQUIRED.",
    "",
    "Controlled-runtime honesty:",
    "  - cryptographic delegation verification: false",
    "  - Agent Registry lookup: false",
    "  - production activation: false",
    "  - raw proof printing: false",
    "  - Gateway called: false",
    "  - CRP called: false",
    "  - payment attempted: false",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg = argv[index];

    if (
      arg === "--help" ||
      arg === "-h"
    ) {
      args.help = true;
      continue;
    }

    const next = argv[index + 1];

    switch (arg) {
      case "--payment-required":
        args.paymentRequiredPath = next;
        index += 1;
        break;

      case "--out":
        args.outPath = next;
        index += 1;
        break;

      case "--region":
        args.region =
          String(next ?? "")
            .toUpperCase();
        index += 1;
        break;

      case "--age-over":
        args.ageOver = Number(next);
        index += 1;
        break;

      case "--agent-id":
        args.agentId = next;
        index += 1;
        break;

      case "--buyer-commitment":
        args.buyerCommitment = next;
        index += 1;
        break;

      case "--buyer-account":
        args.buyerAccount = next;
        index += 1;
        break;

      case "--policy-subject":
        args.policySubject = next;
        index += 1;
        break;

      case "--delegation-id":
        args.delegationId = next;
        index += 1;
        break;

      default:
        throw new Error(
          `unsupported argument: ${arg}`,
        );
    }
  }

  return args;
}

function requireNonEmpty(
  value: string | undefined,
  name: string,
): string {
  if (
    !value ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value;
}

function requireWholeNumber(
  value: number | undefined,
  name: string,
): number {
  if (
    !Number.isInteger(value) ||
    Number(value) < 0
  ) {
    throw new Error(
      `${name} must be a non-negative whole number`,
    );
  }

  return Number(value);
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readJsonFile(
  filePath: string,
): JsonRecord {
  const parsed =
    JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    );

  if (!isRecord(parsed)) {
    throw new Error(
      `${filePath} must contain a JSON object`,
    );
  }

  return parsed;
}

function requiredString(
  record: JsonRecord,
  field: string,
): string {
  const value = record[field];

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `PAYMENT-REQUIRED missing ${field}`,
    );
  }

  return value;
}

function requiredNumber(
  record: JsonRecord,
  field: string,
): number {
  const value = record[field];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `PAYMENT-REQUIRED missing numeric ${field}`,
    );
  }

  return value;
}

function requiredRecord(
  record: JsonRecord,
  field: string,
): JsonRecord {
  const value = record[field];

  if (!isRecord(value)) {
    throw new Error(
      `PAYMENT-REQUIRED missing object ${field}`,
    );
  }

  return value;
}

function buildAuthorizationProof(input: {
  paymentRequired: JsonRecord;
  region: string;
  ageOver: number;
  agentId: string;
  buyerCommitment: string;
  buyerAccount: string;
  policySubject: string;
  delegationId: string;
}): JsonRecord {
  const pr = input.paymentRequired;

  const nonce =
    requiredString(pr, "nonce");

  const merchantId =
    requiredString(pr, "merchantId");

  const contractId =
    requiredString(pr, "contractId");

  const contractVersion =
    requiredString(
      pr,
      "contractVersion",
    );

  const network =
    requiredString(pr, "network");

  const chainId =
    requiredString(pr, "chain_id");

  const amount =
    requiredString(pr, "amount");

  const payTo =
    requiredString(pr, "payTo");

  const issuedAt =
    requiredNumber(pr, "issuedAt");

  const expiresAt =
    requiredNumber(pr, "expiresAt");

  const resource =
    requiredRecord(pr, "resource");

  const asset =
    requiredRecord(pr, "asset");

  const resourceMethod =
    requiredString(
      resource,
      "method",
    ).toUpperCase();

  const resourcePath =
    requiredString(
      resource,
      "path",
    );

  if (
    resourceMethod !== "GET" ||
    resourcePath !== "/paid-gated"
  ) {
    throw new Error(
      "PAYMENT-REQUIRED must describe GET /paid-gated",
    );
  }

  const assetType =
    requiredString(asset, "type");

  const tokenId =
    requiredString(asset, "tokenId");

  const decimals =
    requiredNumber(asset, "decimals");

  if (!Number.isInteger(decimals)) {
    throw new Error(
      "PAYMENT-REQUIRED asset.decimals must be an integer",
    );
  }

  const policyRequirements =
    requiredRecord(
      pr,
      "policyRequirements",
    );

  if (
    policyRequirements.required !== true
  ) {
    throw new Error(
      "PAYMENT-REQUIRED policyRequirements.required must be true",
    );
  }

  const acceptedProofTypes =
    Array.isArray(
      policyRequirements
        .acceptedProofTypes,
    )
      ? policyRequirements
          .acceptedProofTypes
          .map(String)
      : [];

  if (
    !acceptedProofTypes.includes(
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
    )
  ) {
    throw new Error(
      "Gateway did not advertise the canonical Phase 5 agent-delegated proof type",
    );
  }

  const challenge =
    buildX402ZkpChallenge({
      merchantId,
      resource: {
        method: resourceMethod,
        path: resourcePath,
      },
      contract: {
        contractId,
        contractVersion,
        isFrozen:
          pr.isFrozen === true,
      },
      network,
      chain_id: chainId,
      caip2ChainId: null,
      asset: {
        type: assetType,
        tokenId,
        decimals,
      },
      amount,
      amountMinor:
        amountToRawUnits(
          amount,
          decimals,
        ),
      payTo,
      nonce,
      issuedAt,
      expiresAt,
      policy:
        PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
      businessTerms: null,
      buyer: null,
      agent: null,
    });

  const challengeHash =
    hashX402ZkpChallenge(
      challenge,
    );

  return {
    authorizationProofType:
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,

    agent: {
      agentId: input.agentId,
      agentType:
        "controlled-local-demo-agent",
    },

    buyer: {
      buyerCommitment:
        input.buyerCommitment,
      buyerAccount:
        input.buyerAccount,
      policySubject:
        input.policySubject,
    },

    delegation: {
      delegationId:
        input.delegationId,
      delegationIssuedAt:
        issuedAt - 60,
      delegationExpiresAt:
        expiresAt + 60,
      delegationProofPresent: true,
      delegationProofPrinted: false,
    },

    challenge: {
      nonce,
      challengeHash,
      issuedAt,
      expiresAt,
    },

    scope: {
      merchantId,
      resource: {
        method: resourceMethod,
        path: resourcePath,
      },
      contractId,
      contractVersion,
      network,
      asset: {
        type: assetType,
        tokenId,
        decimals,
      },
      amount,
      payTo,
      allowedAction:
        PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
      maxUses:
        PHASE5_AGENT_RUNTIME_MAX_USES,
    },

    policyEvidence: {
      proofType:
        "concordium.VerifiablePresentation",
      claims: {
        region: input.region,
        ageOver: input.ageOver,
      },
      rawProofPrinted: false,
    },
  };
}

function main(): void {
  const args =
    parseArgs(
      process.argv.slice(2),
    );

  if (args.help) {
    console.log(usage());
    return;
  }

  const paymentRequiredPath =
    requireNonEmpty(
      args.paymentRequiredPath,
      "--payment-required",
    );

  const outPath =
    requireNonEmpty(
      args.outPath,
      "--out",
    );

  const region =
    requireNonEmpty(
      args.region,
      "--region",
    ).toUpperCase();

  const ageOver =
    requireWholeNumber(
      args.ageOver,
      "--age-over",
    );

  if (
    region !== "EU" &&
    region !== "US"
  ) {
    throw new Error(
      "--region must be EU or US",
    );
  }

  if (
    !fs.existsSync(
      paymentRequiredPath,
    )
  ) {
    throw new Error(
      `PAYMENT-REQUIRED file not found: ${paymentRequiredPath}`,
    );
  }

  const paymentRequired =
    readJsonFile(
      paymentRequiredPath,
    );

  const nonce =
    requiredString(
      paymentRequired,
      "nonce",
    );

  const authorizationProof =
    buildAuthorizationProof({
      paymentRequired,
      region,
      ageOver,
      agentId:
        args.agentId ??
        "agent:local-demo:phase5-agent-delegated-e2e",
      buyerCommitment:
        args.buyerCommitment ??
        "sha256:phase5-agent-delegated-demo-buyer-commitment",
      buyerAccount:
        args.buyerAccount ??
        "ccd1qphase5agentdelegateddemobuyer",
      policySubject:
        args.policySubject ??
        "buyer:phase5-agent-delegated-demo",
      delegationId:
        args.delegationId ??
        `delegation-${nonce}`,
    });

  const body = {
    nonce,
    authorizationProof,
  };

  fs.mkdirSync(
    path.dirname(outPath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    outPath,
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        helper:
          "demo.agentDelegatedAuthorizationProof.v1",
        mode:
          "controlled_e2e_demo",
        outPath,
        nonce,
        region,
        ageOver,
        authorizationProofType:
          PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
        challengeHashPresent: true,
        delegationProofPresent: true,
        delegationProofPrinted: false,
        rawProofPrinted: false,
        cryptographicDelegationVerification:
          false,
        agentRegistryLookupAttempted:
          false,
        productionActivation: false,
        gatewayCalled: false,
        crpCalled: false,
        paymentAttempted: false,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    JSON.stringify(
      {
        ok: false,
        helper:
          "demo.agentDelegatedAuthorizationProof.v1",
        reason: message,
        rawProofPrinted: false,
        cryptographicDelegationVerification:
          false,
        agentRegistryLookupAttempted:
          false,
        productionActivation: false,
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
