import * as fs from "node:fs";
import * as path from "node:path";

import {
  verifyAgentProofOfPossession,
  type AgentProofOfPossessionDocument,
  type AgentProofOfPossessionVerificationResult,
} from "../src/phase5/agentProofOfPossessionVerifier";

import type {
  Phase5AgentDelegationBindingContext,
} from "../src/phase5/agentDelegationBindingVerifier";

import {
  PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,
  verifyPhase5AgentCryptographicDelegationBindings,
  type Phase5AgentCryptographicBindingInput,
  type Phase5AgentCryptographicBindingReason,
  type Phase5AgentCryptographicBindingResult,
} from "../src/phase5/agentCryptographicDelegationBindingVerifier";

import type {
  BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

import type {
  BuyerToAgentDelegationCredentialDocument,
} from "../src/phase5/buyerToAgentDelegationCredential";

type JsonRecord = Record<string, unknown>;

type HarnessCase = {
  readonly name: string;

  readonly expectedReason:
    Phase5AgentCryptographicBindingReason;

  readonly expectedOk: boolean;

  readonly expectedMismatchFields:
    readonly string[];

  readonly makeInput: () =>
    Phase5AgentCryptographicBindingInput;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;

  readonly expectedReason:
    Phase5AgentCryptographicBindingReason;

  readonly actualReason:
    Phase5AgentCryptographicBindingReason;

  readonly expectedMismatchFields:
    readonly string[];

  readonly actualMismatchFields:
    readonly string[];

  readonly result:
    Phase5AgentCryptographicBindingResult;
};

const ROOT = process.cwd();

const FIXTURE_DIRECTORY =
  "fixtures/phase5/agent-proof-of-possession";

const DELEGATION_PATH =
  `${FIXTURE_DIRECTORY}/delegation.valid.example.json`;

const BUYER_KEY_PATH =
  `${FIXTURE_DIRECTORY}/buyer.verification-key.json`;

const PROOF_PATH =
  `${FIXTURE_DIRECTORY}/agent-proof.valid.example.json`;

const FALSE_SAFETY_FIELDS = [
  "buyerVerificationKeyTrustEstablished",
  "buyerIdentityAuthenticated",
  "buyerKeyOwnershipEstablished",
  "agentIdentityAuthenticated",
  "agentKeyTrustEstablished",
  "currentAuthorizationEstablished",
  "validityEvaluatedAgainstClock",
  "revocationChecked",
  "boundedUseConsumed",
  "challengeReplayStateMutated",
  "gatewayCalled",
  "crpCalled",
  "paymentAttempted",
  "receiptJwsPrinted",
  "paymentResponsePrinted",
  "protectedResourceReleased",
  "agentRegistryLookupAttempted",
  "productionActivation",
] as const;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson<T>(
  relativePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        relativePath,
      ),
      "utf8",
    ),
  ) as T;
}

function clone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function assertNoPrivateJwkFields(
  value: unknown,
  location = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        assertNoPrivateJwkFields(
          item,
          `${location}[${index}]`,
        ),
    );

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  for (
    const [key, nested]
    of Object.entries(
      value as JsonRecord,
    )
  ) {
    assert(
      key !== "d",
      `private JWK component found at ${location}.${key}`,
    );

    assertNoPrivateJwkFields(
      nested,
      `${location}.${key}`,
    );
  }
}

const VALID_DELEGATION =
  readJson<
    BuyerToAgentDelegationCredentialDocument
  >(
    DELEGATION_PATH,
  );

const VALID_BUYER_KEY =
  readJson<
    BuyerDelegationVerificationKey
  >(
    BUYER_KEY_PATH,
  );

const VALID_PROOF =
  readJson<
    AgentProofOfPossessionDocument
  >(
    PROOF_PATH,
  );

function createValidProofVerification():
AgentProofOfPossessionVerificationResult {
  return verifyAgentProofOfPossession({
    delegationDocument:
      clone(VALID_DELEGATION),

    buyerVerificationKey:
      clone(VALID_BUYER_KEY),

    proofDocument:
      clone(VALID_PROOF),

    expectedChallenge:
      clone(
        VALID_PROOF.statement.challenge,
      ),
  });
}

function baseOuterEnvelope(): JsonRecord {
  const credential =
    VALID_DELEGATION.credential;

  return {
    authorizationProofType:
      "xcf.agent_delegated_authorization.v1",

    delegation: {
      delegationId:
        credential.delegationId,

      delegationIssuedAt:
        credential.validity.issuedAt,

      delegationExpiresAt:
        credential.validity.expiresAt,
    },

    buyer: {
      policySubject:
        credential.issuer.buyerId,
    },

    agent: {
      agentId:
        credential.subject.agentId,
    },
  };
}

function baseExpectedContext():
Phase5AgentDelegationBindingContext {
  const credential =
    VALID_DELEGATION.credential;

  const challenge =
    VALID_PROOF.statement.challenge;

  return {
    nowSec:
      challenge.issuedAt,

    challenge: {
      nonce:
        challenge.nonce,

      challengeHash:
        challenge.challengeHash,

      issuedAt:
        challenge.issuedAt,

      expiresAt:
        challenge.expiresAt,
    },

    scope: {
      merchantId:
        credential.scope.merchantId,

      resourceMethod:
        credential.scope.resource.method,

      resourcePath:
        credential.scope.resource.path,

      contractId:
        credential.scope.contract.contractId,

      contractVersion:
        credential.scope.contract.contractVersion,

      allowedAction:
        credential.scope.allowedAction,

      maxUses:
        credential.usage.maxUses,
    },

    paymentTuple: {
      network:
        credential.scope.network,

      assetType:
        credential.scope.asset.type,

      tokenId:
        credential.scope.asset.tokenId,

      decimals:
        credential.scope.asset.decimals,

      amount:
        credential.scope.amount.value,

      payTo:
        credential.scope.payTo,
    },
  };
}

function baseInput():
Phase5AgentCryptographicBindingInput {
  return {
    outerEnvelope:
      baseOuterEnvelope(),

    delegationDocument:
      clone(VALID_DELEGATION),

    proofVerification:
      createValidProofVerification(),

    expectedContext:
      baseExpectedContext(),

    expectedAudience:
      PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,
  };
}

function mutateInput(
  mutate: (
    input: any,
  ) => void,
): Phase5AgentCryptographicBindingInput {
  const input =
    clone(
      baseInput(),
    ) as any;

  mutate(input);

  return input as
    Phase5AgentCryptographicBindingInput;
}

const CASES:
readonly HarnessCase[] = [
  {
    name:
      "valid cryptographic delegation is bound to the controlled runtime context",

    expectedReason:
      "accepted",

    expectedOk:
      true,

    expectedMismatchFields:
      [],

    makeInput:
      baseInput,
  },

  {
    name:
      "cryptographic verification must already be established",

    expectedReason:
      "cryptographic_delegation_not_verified",

    expectedOk:
      false,

    expectedMismatchFields:
      [],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .proofVerification
            .ok = false;

          input
            .proofVerification
            .status = "rejected";

          input
            .proofVerification
            .reason =
              "agent_proof_verification_failed";

          input
            .proofVerification
            .agentProofOfPossessionVerified =
              false;
        },
      ),
  },

  {
    name:
      "malformed verified delegation document is rejected without dereference failure",

    expectedReason:
      "invalid_verified_delegation_document",

    expectedOk:
      false,

    expectedMismatchFields: [
      "delegationDocument",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input.delegationDocument = {
            credential: {},
            proof: {},
          };
        },
      ),
  },

  {
    name:
      "verification result must describe the supplied delegation document",

    expectedReason:
      "verified_delegation_document_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.hash",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .proofVerification
            .credentialHash =
              "0".repeat(64);
        },
      ),
  },

  {
    name:
      "outer delegation ID must equal the buyer-signed delegation ID",

    expectedReason:
      "outer_delegation_identity_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "outer.delegation.delegationId",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .outerEnvelope
            .delegation
            .delegationId =
              "delegation-mismatch";
        },
      ),
  },

  {
    name:
      "outer buyer policy subject must equal the signed buyer identity",

    expectedReason:
      "outer_delegation_identity_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "outer.buyer.policySubject",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .outerEnvelope
            .buyer
            .policySubject =
              "buyer:mismatch";
        },
      ),
  },

  {
    name:
      "outer agent identity must equal the signed delegated agent identity",

    expectedReason:
      "outer_delegation_identity_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "outer.agent.agentId",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .outerEnvelope
            .agent
            .agentId =
              "agent:mismatch";
        },
      ),
  },

  {
    name:
      "buyer-signed contract scope must match the controlled runtime scope",

    expectedReason:
      "signed_delegation_scope_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.scope.contract.contractId",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .expectedContext
            .scope
            .contractId =
              "cid_runtime_mismatch";
        },
      ),
  },

  {
    name:
      "buyer-signed exact payment amount must match the runtime payment tuple",

    expectedReason:
      "signed_delegation_payment_tuple_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.scope.amount",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .expectedContext
            .paymentTuple
            .amount =
              "0.050102";
        },
      ),
  },

  {
    name:
      "buyer-signed validity window must cover the complete challenge window",

    expectedReason:
      "signed_delegation_validity_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.validity.expiresAt",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .expectedContext
            .challenge
            .expiresAt += 1;
        },
      ),
  },

  {
    name:
      "buyer-signed usage limit must equal controlled runtime maxUses",

    expectedReason:
      "signed_delegation_usage_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.usage.maxUses",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input
            .expectedContext
            .scope
            .maxUses = 2;
        },
      ),
  },

  {
    name:
      "buyer-signed replay audience must match the runtime audience",

    expectedReason:
      "signed_delegation_replay_mismatch",

    expectedOk:
      false,

    expectedMismatchFields: [
      "credential.replay.audience",
    ],

    makeInput: () =>
      mutateInput(
        (input) => {
          input.expectedAudience =
            "xcf-gateway:mismatch";
        },
      ),
  },
];

function assertSafetyContract(
  result:
    Phase5AgentCryptographicBindingResult,
): void {
  for (
    const field of FALSE_SAFETY_FIELDS
  ) {
    assert(
      result[field] === false,
      `${field} must remain false`,
    );
  }

  assert(
    result.mode ===
      "controlled_cryptographic_demo2",
    "unexpected cryptographic binding mode",
  );
}

function evaluateCase(
  fixtureCase: HarnessCase,
): EvaluatedCase {
  const result =
    verifyPhase5AgentCryptographicDelegationBindings(
      fixtureCase.makeInput(),
    );

  assertSafetyContract(result);

  const statusMatches =
    fixtureCase.expectedOk
      ? (
          result.ok === true &&
          result.status === "accepted"
        )
      : (
          result.ok === false &&
          result.status === "rejected"
        );

  const reasonMatches =
    result.reason ===
    fixtureCase.expectedReason;

  const mismatchFieldsMatch =
    JSON.stringify(
      result.mismatchFields,
    ) ===
    JSON.stringify(
      fixtureCase.expectedMismatchFields,
    );

  if (fixtureCase.expectedOk) {
    assert(
      result
        .cryptographicDelegationVerification ===
        true,
      `${fixtureCase.name}: cryptographic delegation not verified`,
    );

    assert(
      result.buyerSignatureVerified === true,
      `${fixtureCase.name}: buyer signature not verified`,
    );

    assert(
      result
        .agentProofOfPossessionVerified ===
        true,
      `${fixtureCase.name}: agent PoP not verified`,
    );

    assert(
      result
        .verifiedDelegationDocumentMatched ===
        true,
      `${fixtureCase.name}: verified document not matched`,
    );

    assert(
      result
        .outerDelegationIdentityBound ===
        true,
      `${fixtureCase.name}: outer identity not bound`,
    );

    assert(
      result
        .buyerPolicySubjectBound ===
        true,
      `${fixtureCase.name}: buyer policy subject not bound`,
    );

    assert(
      result.signedScopeBound === true,
      `${fixtureCase.name}: signed scope not bound`,
    );

    assert(
      result
        .signedPaymentTupleBound ===
        true,
      `${fixtureCase.name}: signed payment tuple not bound`,
    );

    assert(
      result
        .credentialValidityCoversChallenge ===
        true,
      `${fixtureCase.name}: validity window does not cover challenge`,
    );

    assert(
      result.signedUsageBound === true,
      `${fixtureCase.name}: signed usage not bound`,
    );

    assert(
      result.signedReplayBound === true,
      `${fixtureCase.name}: signed replay values not bound`,
    );
  }

  return {
    name:
      fixtureCase.name,

    ok:
      statusMatches &&
      reasonMatches &&
      mismatchFieldsMatch,

    expectedReason:
      fixtureCase.expectedReason,

    actualReason:
      result.reason,

    expectedMismatchFields: [
      ...fixtureCase.expectedMismatchFields,
    ],

    actualMismatchFields: [
      ...result.mismatchFields,
    ],

    result,
  };
}

function main(): void {
  assert(
    CASES.length === 12,
    `expected 12 cases, found ${CASES.length}`,
  );

  assertNoPrivateJwkFields(
    VALID_DELEGATION,
  );

  assertNoPrivateJwkFields(
    VALID_BUYER_KEY,
  );

  assertNoPrivateJwkFields(
    VALID_PROOF,
  );

  const authenticProofResult =
    createValidProofVerification();

  assert(
    authenticProofResult.ok === true,
    "PR #295 proof verification did not pass",
  );

  assert(
    authenticProofResult
      .buyerSignatureVerified ===
      true,
    "PR #294 buyer signature was not verified",
  );

  assert(
    authenticProofResult
      .agentPublicKeyBoundByBuyerSignature ===
      true,
    "delegated agent key was not buyer-signed",
  );

  assert(
    authenticProofResult
      .agentProofOfPossessionVerified ===
      true,
    "PR #295 agent proof was not verified",
  );

  const evaluated =
    CASES.map(
      evaluateCase,
    );

  const allCasesPassed =
    evaluated.every(
      (fixtureCase) =>
        fixtureCase.ok,
    );

  const positiveCount =
    evaluated.filter(
      (fixtureCase) =>
        fixtureCase.result.ok,
    ).length;

  const summary = {
    ok:
      allCasesPassed,

    label:
      "phase5:agent-cryptographic-runtime-composition-test",

    contract:
      "phase5.agentCryptographicDelegationBindingVerifier.v1",

    mode:
      "controlled_cryptographic_demo2",

    testOnly:
      true,

    caseCount:
      evaluated.length,

    positiveCount,

    negativeCount:
      evaluated.length -
      positiveCount,

    authenticPrerequisite: {
      delegationContractValidated:
        authenticProofResult
          .delegationContractValidated,

      buyerSignatureVerified:
        authenticProofResult
          .buyerSignatureVerified,

      agentPublicKeyBoundByBuyerSignature:
        authenticProofResult
          .agentPublicKeyBoundByBuyerSignature,

      agentProofOfPossessionVerified:
        authenticProofResult
          .agentProofOfPossessionVerified,
    },

    acceptedBinding: {
      outerDelegationIdentityBound:
        evaluated[0]
          .result
          .outerDelegationIdentityBound,

      buyerPolicySubjectBound:
        evaluated[0]
          .result
          .buyerPolicySubjectBound,

      signedScopeBound:
        evaluated[0]
          .result
          .signedScopeBound,

      signedPaymentTupleBound:
        evaluated[0]
          .result
          .signedPaymentTupleBound,

      credentialValidityCoversChallenge:
        evaluated[0]
          .result
          .credentialValidityCoversChallenge,

      signedUsageBound:
        evaluated[0]
          .result
          .signedUsageBound,

      signedReplayBound:
        evaluated[0]
          .result
          .signedReplayBound,
    },

    cases:
      evaluated.map(
        (fixtureCase) => ({
          name:
            fixtureCase.name,

          ok:
            fixtureCase.ok,

          expectedReason:
            fixtureCase.expectedReason,

          actualReason:
            fixtureCase.actualReason,

          expectedMismatchFields:
            fixtureCase.expectedMismatchFields,

          actualMismatchFields:
            fixtureCase.actualMismatchFields,

          status:
            fixtureCase.result.status,
        }),
      ),

    trustBoundary: {
      mathematicalBuyerSignatureVerified:
        true,

      mathematicalAgentProofOfPossessionVerified:
        true,

      buyerVerificationKeyTrustEstablished:
        false,

      buyerIdentityAuthenticated:
        false,

      agentIdentityAuthenticated:
        false,

      currentAuthorizationEstablished:
        false,
    },

    lifecycleBoundary: {
      validityEvaluatedAgainstClock:
        false,

      revocationChecked:
        false,

      boundedUseConsumed:
        false,

      challengeReplayStateMutated:
        false,
    },

    sideEffects: {
      gatewayCalled:
        false,

      crpCalled:
        false,

      paymentAttempted:
        false,

      receiptJwsPrinted:
        false,

      paymentResponsePrinted:
        false,

      protectedResourceReleased:
        false,

      agentRegistryLookupAttempted:
        false,

      productionActivation:
        false,
    },

    nextImplementationStep:
      "execute the controlled cryptographic Demo2 end-to-end acceptance flow",
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  if (!allCasesPassed) {
    process.exitCode = 1;
  }
}

main();
