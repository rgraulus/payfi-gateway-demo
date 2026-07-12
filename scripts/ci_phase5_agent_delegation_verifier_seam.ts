import * as fs from "fs";
import * as path from "path";

import {
  verifyPhase5AgentDelegationFixture,
  type Phase5AgentDelegationVerifierReason,
  type Phase5AgentDelegationVerifierResult,
} from "./phase5_agent_delegation_verifier";

type JsonRecord = Record<string, unknown>;

type FixtureCase = {
  readonly name: string;
  readonly relativePath: string;
  readonly expectedOk: boolean;
  readonly expectedReason: Phase5AgentDelegationVerifierReason;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly expectedOk: boolean;
  readonly actualOk: boolean;
  readonly expectedReason: Phase5AgentDelegationVerifierReason;
  readonly actualReason: Phase5AgentDelegationVerifierReason;
  readonly result: Phase5AgentDelegationVerifierResult;
};

const ROOT = process.cwd();

const FIXTURE_CASES: readonly FixtureCase[] = [
  {
    name: "valid agent-delegated envelope",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.valid.example.json",
    expectedOk: true,
    expectedReason: "accepted",
  },
  {
    name: "invalid missing agent",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-agent.example.json",
    expectedOk: false,
    expectedReason: "missing_agent_identity",
  },
  {
    name: "invalid missing buyer binding",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-buyer-binding.example.json",
    expectedOk: false,
    expectedReason: "missing_buyer_binding",
  },
  {
    name: "invalid missing delegation",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-delegation.example.json",
    expectedOk: false,
    expectedReason: "missing_delegation",
  },
  {
    name: "invalid delegation proof not present",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-delegation-proof-not-present.example.json",
    expectedOk: false,
    expectedReason: "delegation_proof_not_present",
  },
  {
    name: "invalid delegation proof printed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-delegation-proof-printed.example.json",
    expectedOk: false,
    expectedReason: "delegation_proof_must_not_be_printed",
  },
  {
    name: "invalid unsupported authorization proof type",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-unsupported-envelope-type.example.json",
    expectedOk: false,
    expectedReason: "unsupported_authorization_proof_type",
  },
];

function readJson(relativePath: string): JsonRecord {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(
    fs.readFileSync(absolutePath, "utf8"),
  ) as JsonRecord;
}

function safetyContractSatisfied(
  result: Phase5AgentDelegationVerifierResult,
): boolean {
  return (
    result.mode === "test_fixture_only" &&
    result.rawProofPrinted === false &&
    result.gatewayCalled === false &&
    result.crpCalled === false &&
    result.paymentAttempted === false &&
    result.receiptJwsPrinted === false &&
    result.paymentResponsePrinted === false &&
    result.productionActivation === false
  );
}

function statusContractSatisfied(
  result: Phase5AgentDelegationVerifierResult,
): boolean {
  if (result.ok) {
    return (
      result.status === "accepted" &&
      result.reason === "accepted"
    );
  }

  return (
    result.status === "rejected" &&
    result.reason !== "accepted"
  );
}

function evaluateFixture(
  fixtureCase: FixtureCase,
): EvaluatedCase {
  const envelope = readJson(fixtureCase.relativePath);
  const result = verifyPhase5AgentDelegationFixture(envelope);

  const ok =
    result.ok === fixtureCase.expectedOk &&
    result.reason === fixtureCase.expectedReason &&
    safetyContractSatisfied(result) &&
    statusContractSatisfied(result);

  return {
    name: fixtureCase.name,
    ok,
    expectedOk: fixtureCase.expectedOk,
    actualOk: result.ok,
    expectedReason: fixtureCase.expectedReason,
    actualReason: result.reason,
    result,
  };
}

function main(): void {
  const evaluated = FIXTURE_CASES.map(evaluateFixture);
  const ok = evaluated.every((fixtureCase) => fixtureCase.ok);

  const summary = {
    ok,
    label: "phase5:agent-delegation-verifier-seam-test",
    testOnly: true,
    metadataOnly: true,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    productionActivation: false,
    cases: evaluated.map((fixtureCase) => ({
      name: fixtureCase.name,
      ok: fixtureCase.ok,
      expectedOk: fixtureCase.expectedOk,
      actualOk: fixtureCase.actualOk,
      expectedReason: fixtureCase.expectedReason,
      actualReason: fixtureCase.actualReason,
      status: fixtureCase.result.status,
      mode: fixtureCase.result.mode,
      authorizationProofType:
        fixtureCase.result.authorizationProofType,
      agentId: fixtureCase.result.agentId,
      buyerCommitmentPresent:
        fixtureCase.result.buyerCommitmentPresent,
      delegationId: fixtureCase.result.delegationId,
      delegationProofPresent:
        fixtureCase.result.delegationProofPresent,
      delegationProofPrinted:
        fixtureCase.result.delegationProofPrinted,
      rawProofPrinted:
        fixtureCase.result.rawProofPrinted,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
