import * as fs from "fs";
import * as path from "path";

import {
  verifyPhase5AgentDelegationBindings,
  type Phase5AgentDelegationBindingContext,
  type Phase5AgentDelegationBindingVerifierReason,
  type Phase5AgentDelegationBindingVerifierResult,
} from "./phase5_agent_delegation_binding_verifier";

type JsonRecord = Record<string, unknown>;

type ExpectedBindingState = {
  readonly bindingEvaluated: boolean;
  readonly challengeBound: boolean;
  readonly scopeBound: boolean;
  readonly paymentTupleBound: boolean;
  readonly challengeExpired: boolean;
  readonly delegationExpired: boolean;
  readonly delegationCoversChallengeWindow: boolean;
};

type FixtureCase = {
  readonly name: string;
  readonly relativePath: string;
  readonly expectedReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly expectedMismatchFields: readonly string[];
  readonly expectedState: ExpectedBindingState;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly expectedReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly actualReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly expectedMismatchFields: readonly string[];
  readonly actualMismatchFields: readonly string[];
  readonly result:
    Phase5AgentDelegationBindingVerifierResult;
};

const ROOT = process.cwd();

const EXPECTED_CONTEXT: Phase5AgentDelegationBindingContext = {
  nowSec: 1780000100,
  challenge: {
    nonce: "demo-phase5-valid-nonce",
    challengeHash:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
  scope: {
    merchantId: "demo-merchant",
    resourceMethod: "GET",
    resourcePath: "/paid-gated",
    contractId:
      "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
    contractVersion: "1.0.0",
    allowedAction:
      "authorize_payment_and_resource_access",
    maxUses: 1,
  },
  paymentTuple: {
    network: "concordium:testnet",
    assetType: "PLT",
    tokenId: "EUDemo",
    decimals: 6,
    amount: "0.050101",
    payTo:
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
  },
};

const ALL_BINDINGS_VALID: ExpectedBindingState = {
  bindingEvaluated: true,
  challengeBound: true,
  scopeBound: true,
  paymentTupleBound: true,
  challengeExpired: false,
  delegationExpired: false,
  delegationCoversChallengeWindow: true,
};

const FIXTURE_CASES: readonly FixtureCase[] = [
  {
    name: "valid exact binding",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.valid.example.json",
    expectedReason: "accepted",
    expectedMismatchFields: [],
    expectedState: ALL_BINDINGS_VALID,
  },
  {
    name: "basic verifier rejection is preserved",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-agent.example.json",
    expectedReason: "missing_agent_identity",
    expectedMismatchFields: [],
    expectedState: {
      bindingEvaluated: false,
      challengeBound: false,
      scopeBound: false,
      paymentTupleBound: false,
      challengeExpired: false,
      delegationExpired: false,
      delegationCoversChallengeWindow: false,
    },
  },
  {
    name: "challenge binding mismatch",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-challenge-binding.example.json",
    expectedReason: "challenge_binding_mismatch",
    expectedMismatchFields: [
      "challenge.nonce",
      "challenge.challengeHash",
    ],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      challengeBound: false,
    },
  },
  {
    name: "scope binding mismatch",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-scope-binding.example.json",
    expectedReason: "scope_binding_mismatch",
    expectedMismatchFields: [
      "scope.merchantId",
      "scope.resource.method",
      "scope.resource.path",
      "scope.contractId",
      "scope.contractVersion",
      "scope.allowedAction",
      "scope.maxUses",
    ],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      scopeBound: false,
    },
  },
  {
    name: "payment tuple binding mismatch",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-payment-tuple-binding.example.json",
    expectedReason:
      "payment_tuple_binding_mismatch",
    expectedMismatchFields: [
      "scope.network",
      "scope.asset.type",
      "scope.asset.tokenId",
      "scope.asset.decimals",
      "scope.amount",
      "scope.payTo",
    ],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      paymentTupleBound: false,
    },
  },
  {
    name: "challenge expired",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-challenge-expired.example.json",
    expectedReason: "challenge_expired",
    expectedMismatchFields: [],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      challengeExpired: true,
    },
  },
  {
    name: "delegation expired",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-delegation-expired.example.json",
    expectedReason: "delegation_expired",
    expectedMismatchFields: [],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      delegationExpired: true,
      delegationCoversChallengeWindow: false,
    },
  },
  {
    name: "delegation does not cover challenge window",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-delegation-challenge-window.example.json",
    expectedReason:
      "delegation_challenge_window_mismatch",
    expectedMismatchFields: [
      "delegation.delegationExpiresAt",
    ],
    expectedState: {
      ...ALL_BINDINGS_VALID,
      delegationCoversChallengeWindow: false,
    },
  },
];

function readJson(relativePath: string): JsonRecord {
  const absolutePath = path.join(ROOT, relativePath);

  return JSON.parse(
    fs.readFileSync(absolutePath, "utf8"),
  ) as JsonRecord;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) => value === right[index],
    )
  );
}

function safetyContractSatisfied(
  result: Phase5AgentDelegationBindingVerifierResult,
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

function stateMatches(
  result: Phase5AgentDelegationBindingVerifierResult,
  expected: ExpectedBindingState,
): boolean {
  return (
    result.bindingEvaluated ===
      expected.bindingEvaluated &&
    result.challengeBound ===
      expected.challengeBound &&
    result.scopeBound ===
      expected.scopeBound &&
    result.paymentTupleBound ===
      expected.paymentTupleBound &&
    result.challengeExpired ===
      expected.challengeExpired &&
    result.delegationExpired ===
      expected.delegationExpired &&
    result.delegationCoversChallengeWindow ===
      expected.delegationCoversChallengeWindow
  );
}

function statusContractSatisfied(
  result: Phase5AgentDelegationBindingVerifierResult,
): boolean {
  if (result.reason === "accepted") {
    return result.ok && result.status === "accepted";
  }

  return !result.ok && result.status === "rejected";
}

function evaluateFixture(
  fixtureCase: FixtureCase,
): EvaluatedCase {
  const envelope = readJson(fixtureCase.relativePath);
  const result = verifyPhase5AgentDelegationBindings(
    envelope,
    EXPECTED_CONTEXT,
  );

  const ok =
    result.reason === fixtureCase.expectedReason &&
    arraysEqual(
      result.mismatchFields,
      fixtureCase.expectedMismatchFields,
    ) &&
    stateMatches(result, fixtureCase.expectedState) &&
    safetyContractSatisfied(result) &&
    statusContractSatisfied(result) &&
    result.verificationTimeSec ===
      EXPECTED_CONTEXT.nowSec;

  return {
    name: fixtureCase.name,
    ok,
    expectedReason: fixtureCase.expectedReason,
    actualReason: result.reason,
    expectedMismatchFields:
      fixtureCase.expectedMismatchFields,
    actualMismatchFields: result.mismatchFields,
    result,
  };
}

function main(): void {
  const evaluated = FIXTURE_CASES.map(evaluateFixture);
  const ok = evaluated.every(
    (fixtureCase) => fixtureCase.ok,
  );

  const summary = {
    ok,
    label:
      "phase5:agent-challenge-scope-expiry-binding-test",
    testOnly: true,
    metadataOnly: true,
    verificationTimeSec: EXPECTED_CONTEXT.nowSec,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    productionActivation: false,
    cases: evaluated.map((fixtureCase) => ({
      name: fixtureCase.name,
      ok: fixtureCase.ok,
      expectedReason: fixtureCase.expectedReason,
      actualReason: fixtureCase.actualReason,
      expectedMismatchFields:
        fixtureCase.expectedMismatchFields,
      actualMismatchFields:
        fixtureCase.actualMismatchFields,
      status: fixtureCase.result.status,
      mode: fixtureCase.result.mode,
      basicVerifierReason:
        fixtureCase.result.basicVerifierReason,
      basicVerifierAccepted:
        fixtureCase.result.basicVerifierAccepted,
      bindingEvaluated:
        fixtureCase.result.bindingEvaluated,
      challengeBound:
        fixtureCase.result.challengeBound,
      scopeBound:
        fixtureCase.result.scopeBound,
      paymentTupleBound:
        fixtureCase.result.paymentTupleBound,
      challengeExpired:
        fixtureCase.result.challengeExpired,
      delegationExpired:
        fixtureCase.result.delegationExpired,
      delegationCoversChallengeWindow:
        fixtureCase.result
          .delegationCoversChallengeWindow,
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
