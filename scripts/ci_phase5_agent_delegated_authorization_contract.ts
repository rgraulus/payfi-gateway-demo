import * as fs from "fs";
import * as path from "path";

type JsonRecord = Record<string, unknown>;

const ROOT = process.cwd();

const FIXTURES = {
  valid: "fixtures/phase5/agent-delegated-authorization.valid.example.json",
  invalidMissingAgent: "fixtures/phase5/agent-delegated-authorization.invalid-missing-agent.example.json",
  invalidWrongScope: "fixtures/phase5/agent-delegated-authorization.invalid-wrong-scope.example.json",
};

const EXPECTED = {
  authorizationProofType: "xcf.concordium.authorization.agent-delegated.v1",
  merchantId: "demo-merchant",
  resourceMethod: "GET",
  resourcePath: "/paid-gated",
  contractId: "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
  contractVersion: "1.0.0",
  network: "concordium:testnet",
  assetType: "PLT",
  tokenId: "EUDemo",
  decimals: 6,
  amount: "0.050101",
  payTo: "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
  allowedAction: "authorize_payment_and_resource_access",
  maxUses: 1,
  replayKeyVersion: "phase5-agent-delegated-v1",
};

const REQUIRED_TOP_LEVEL = [
  "authorizationProofType",
  "agent",
  "buyer",
  "delegation",
  "scope",
  "policyEvidence",
  "challenge",
  "replay",
  "safety",
];

const REQUIRED_REPLAY_FIELDS = [
  "agent.agentId",
  "buyer.buyerCommitment",
  "delegation.delegationId",
  "scope.merchantId",
  "scope.resource.method",
  "scope.resource.path",
  "scope.contractId",
  "scope.contractVersion",
  "scope.network",
  "scope.asset.tokenId",
  "scope.amount",
  "scope.payTo",
  "challenge.nonce",
  "challenge.challengeHash",
];

function readJson(relativePath: string): JsonRecord {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function get(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, obj);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushIf(errors: string[], condition: boolean, message: string): void {
  if (condition) errors.push(message);
}

function validateEnvelope(envelope: JsonRecord): string[] {
  const errors: string[] = [];

  for (const field of REQUIRED_TOP_LEVEL) {
    pushIf(errors, !Object.prototype.hasOwnProperty.call(envelope, field), `missing top-level field: ${field}`);
  }

  pushIf(
    errors,
    envelope.authorizationProofType !== EXPECTED.authorizationProofType,
    "authorizationProofType mismatch",
  );

  pushIf(errors, !isNonEmptyString(get(envelope, "agent.agentId")), "missing agent.agentId");
  pushIf(errors, !isNonEmptyString(get(envelope, "agent.agentKind")), "missing agent.agentKind");

  pushIf(errors, !isNonEmptyString(get(envelope, "buyer.buyerCommitment")), "missing buyer.buyerCommitment");
  pushIf(errors, !isNonEmptyString(get(envelope, "buyer.policySubject")), "missing buyer.policySubject");

  pushIf(errors, !isNonEmptyString(get(envelope, "delegation.delegationId")), "missing delegation.delegationId");
  pushIf(errors, !isNonEmptyString(get(envelope, "delegation.delegationType")), "missing delegation.delegationType");
  pushIf(errors, !isNumber(get(envelope, "delegation.delegationIssuedAt")), "missing delegation.delegationIssuedAt");
  pushIf(errors, !isNumber(get(envelope, "delegation.delegationExpiresAt")), "missing delegation.delegationExpiresAt");
  pushIf(errors, get(envelope, "delegation.delegationProofPresent") !== true, "delegation proof must be present");
  pushIf(errors, get(envelope, "delegation.delegationProofPrinted") !== false, "delegation proof must not be printed");

  const delegationIssuedAt = get(envelope, "delegation.delegationIssuedAt");
  const delegationExpiresAt = get(envelope, "delegation.delegationExpiresAt");
  const challengeIssuedAt = get(envelope, "challenge.issuedAt");
  const challengeExpiresAt = get(envelope, "challenge.expiresAt");

  if (isNumber(delegationIssuedAt) && isNumber(delegationExpiresAt)) {
    pushIf(errors, delegationExpiresAt <= delegationIssuedAt, "delegation expiry must be after delegation issue time");
  }

  if (isNumber(challengeIssuedAt) && isNumber(challengeExpiresAt)) {
    pushIf(errors, challengeExpiresAt <= challengeIssuedAt, "challenge expiry must be after challenge issue time");
  }

  if (isNumber(delegationExpiresAt) && isNumber(challengeExpiresAt)) {
    pushIf(errors, delegationExpiresAt < challengeExpiresAt, "delegation must cover challenge validity window");
  }

  pushIf(errors, get(envelope, "scope.merchantId") !== EXPECTED.merchantId, "scope.merchantId mismatch");
  pushIf(errors, get(envelope, "scope.resource.method") !== EXPECTED.resourceMethod, "scope.resource.method mismatch");
  pushIf(errors, get(envelope, "scope.resource.path") !== EXPECTED.resourcePath, "scope.resource.path mismatch");
  pushIf(errors, get(envelope, "scope.contractId") !== EXPECTED.contractId, "scope.contractId mismatch");
  pushIf(errors, get(envelope, "scope.contractVersion") !== EXPECTED.contractVersion, "scope.contractVersion mismatch");
  pushIf(errors, get(envelope, "scope.network") !== EXPECTED.network, "scope.network mismatch");
  pushIf(errors, get(envelope, "scope.asset.type") !== EXPECTED.assetType, "scope.asset.type mismatch");
  pushIf(errors, get(envelope, "scope.asset.tokenId") !== EXPECTED.tokenId, "scope.asset.tokenId mismatch");
  pushIf(errors, get(envelope, "scope.asset.decimals") !== EXPECTED.decimals, "scope.asset.decimals mismatch");
  pushIf(errors, get(envelope, "scope.amount") !== EXPECTED.amount, "scope.amount mismatch");
  pushIf(errors, get(envelope, "scope.payTo") !== EXPECTED.payTo, "scope.payTo mismatch");
  pushIf(errors, get(envelope, "scope.allowedAction") !== EXPECTED.allowedAction, "scope.allowedAction mismatch");
  pushIf(errors, get(envelope, "scope.maxUses") !== EXPECTED.maxUses, "scope.maxUses mismatch");

  pushIf(errors, !isNonEmptyString(get(envelope, "policyEvidence.proofType")), "missing policyEvidence.proofType");
  pushIf(errors, !isRecord(get(envelope, "policyEvidence.claims")), "missing policyEvidence.claims");
  pushIf(errors, get(envelope, "policyEvidence.rawProofPrinted") !== false, "raw proof must not be printed");

  pushIf(errors, !isNonEmptyString(get(envelope, "challenge.nonce")), "missing challenge.nonce");

  const challengeHash = get(envelope, "challenge.challengeHash");
  pushIf(
    errors,
    !isNonEmptyString(challengeHash) || !/^[a-f0-9]{64}$/.test(challengeHash),
    "challenge.challengeHash must be 64 lowercase hex chars",
  );

  pushIf(errors, get(envelope, "replay.replayKeyVersion") !== EXPECTED.replayKeyVersion, "replayKeyVersion mismatch");

  const replayKeyFields = get(envelope, "replay.replayKeyFields");
  if (!Array.isArray(replayKeyFields)) {
    errors.push("replay.replayKeyFields must be an array");
  } else {
    for (const field of REQUIRED_REPLAY_FIELDS) {
      pushIf(errors, !replayKeyFields.includes(field), `missing replay key field: ${field}`);
    }
  }

  const safetyFields = [
    "gatewayCalled",
    "crpCalled",
    "paymentAttempted",
    "receiptJwsPrinted",
    "paymentResponsePrinted",
    "productionActivation",
  ];

  for (const field of safetyFields) {
    const value = get(envelope, `safety.${field}`);
    pushIf(errors, !isBoolean(value), `safety.${field} must be boolean`);
    pushIf(errors, value !== false, `safety.${field} must be false`);
  }

  return errors;
}

function expectValid(name: string, relativePath: string): { name: string; ok: boolean; errors: string[] } {
  const envelope = readJson(relativePath);
  const errors = validateEnvelope(envelope);
  return { name, ok: errors.length === 0, errors };
}

function expectInvalid(
  name: string,
  relativePath: string,
  expectedErrorFragment: string,
): { name: string; ok: boolean; errors: string[] } {
  const envelope = readJson(relativePath);
  const errors = validateEnvelope(envelope);
  const foundExpectedError = errors.some((error) => error.includes(expectedErrorFragment));
  return { name, ok: errors.length > 0 && foundExpectedError, errors };
}

function main(): void {
  const results = [
    expectValid("valid agent-delegated envelope", FIXTURES.valid),
    expectInvalid("invalid missing agent", FIXTURES.invalidMissingAgent, "agent.agentId"),
    expectInvalid("invalid wrong scope", FIXTURES.invalidWrongScope, "scope.merchantId mismatch"),
  ];

  const ok = results.every((result) => result.ok);

  const summary = {
    ok,
    label: "phase5:agent-delegated-authorization-contract-test",
    metadataOnly: true,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    productionActivation: false,
    fixtures: results.map((result) => ({
      name: result.name,
      ok: result.ok,
      errors: result.errors,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
