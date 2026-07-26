import {
  createHash,
} from 'node:crypto';

import type {
  Phase6AgentRegistryConditionalGatingResultV1,
  Phase6AgentRegistryConditionalGatingStatusV1,
} from '../phase6/agentRegistryConditionalGatingComposition';

import {
  PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_MODE,
  PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_TYPE,
  PHASE6_PAYMENT_ELIGIBILITY_HANDOFF_TYPE,
} from '../phase6/agentRegistryConditionalGatingComposition';

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
} from '../phase6/agentRegistryTrustContract';

import {
  pool,
} from './client';

export type Phase6AgentRegistryAuthorizationAuditInsertInputV1 = {
  readonly challengeId: string;
  readonly nonce: string;
  readonly merchantId: string;

  readonly authorization:
    Phase6AgentRegistryConditionalGatingResultV1;
};

export type Phase6AgentRegistryAuthorizationAuditQueryResultV1 = {
  readonly rowCount: number | null;
  readonly rows:
    readonly Record<string, unknown>[];
};

export type Phase6AgentRegistryAuthorizationAuditQueryExecutorV1 = {
  query(
    text: string,
    values: readonly unknown[],
  ): Promise<
    Phase6AgentRegistryAuthorizationAuditQueryResultV1
  >;
};

export type Phase6AgentRegistryAuthorizationAuditInsertReasonV1 =
  | 'inserted'
  | 'invalid_audit_input'
  | 'database_error'
  | 'insert_not_confirmed';

export type Phase6AgentRegistryAuthorizationAuditInsertResultV1 = {
  readonly ok: boolean;

  readonly reason:
    Phase6AgentRegistryAuthorizationAuditInsertReasonV1;

  readonly decision:
    Phase6AgentRegistryConditionalGatingStatusV1 | null;

  readonly auditPersisted: boolean;
  readonly persistenceAttempted: boolean;
  readonly databaseCalled: boolean;

  readonly auditId: string | null;
  readonly recordedAt: string | null;

  readonly registryEvidenceHash: string | null;
  readonly authorizationEvidenceHash: string | null;

  readonly updateAttempted: false;
  readonly deleteAttempted: false;
  readonly rawMaterialPersisted: false;
  readonly productionActivation: false;
};

export type PersistPhase6AgentRegistryAuthorizationAuditOptionsV1 = {
  readonly executor?:
    Phase6AgentRegistryAuthorizationAuditQueryExecutorV1;
};

type PreparedAuditInsertV1 = {
  readonly decision:
    Phase6AgentRegistryConditionalGatingStatusV1;

  readonly registryEvidenceHash: string | null;
  readonly authorizationEvidenceHash: string;

  readonly values: readonly unknown[];
};

const MAX_IDENTIFIER_LENGTH = 512;
const MAX_EVIDENCE_TEXT_LENGTH = 4096;
const MAX_CAPABILITY_COUNT = 128;

export const PHASE6_AGENT_REGISTRY_AUTHORIZATION_AUDIT_INSERT_SQL = `
  INSERT INTO public.phase6_agent_registry_authorization_audit (
    challenge_id,
    nonce,
    merchant_id,
    decision,
    reason,
    registry_network,
    registry_contract_index,
    registry_contract_subindex,
    registry_module_reference,
    agent_token_id,
    token_address,
    registry_status,
    owner_account,
    owner_account_bound,
    owner_identity_assurance,
    finalized_block_height,
    finalized_block_hash,
    evidence_observed_at,
    evidence_age_seconds,
    indexer_lag_blocks,
    agent_card_expected_hash,
    agent_card_actual_hash,
    agent_card_byte_length,
    agent_card_integrity_verified,
    required_capabilities,
    satisfied_capabilities,
    missing_capabilities,
    capability_policy_satisfied,
    key_binding_required,
    key_binding_verified,
    key_binding_type,
    key_fingerprint,
    registry_evidence_hash,
    authorization_evidence_hash,
    registry_read_captured,
    agent_registry_lookup_attempted,
    registry_network_called,
    cis8_lookup_attempted,
    agent_card_fetch_attempted,
    agent_card_network_called,
    buyer_policy_evaluated,
    canonical_state_mutated,
    bounded_use_consumed,
    replay_state_mutated,
    payment_attempted,
    receipt_issued,
    resource_released,
    production_activation,
    freshness_source
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21,
    $22,
    $23,
    $24,
    $25::jsonb,
    $26::jsonb,
    $27::jsonb,
    $28,
    $29,
    $30,
    $31,
    $32,
    $33,
    $34,
    $35,
    $36,
    $37,
    $38,
    $39,
    $40,
    $41,
    $42,
    $43,
    $44,
    $45,
    $46,
    $47,
    $48,
    $49
  )
  RETURNING
    audit_id::text AS audit_id,
    recorded_at
`;

const defaultQueryExecutor:
  Phase6AgentRegistryAuthorizationAuditQueryExecutorV1 = {
    async query(
      text: string,
      values: readonly unknown[],
    ): Promise<
      Phase6AgentRegistryAuthorizationAuditQueryResultV1
    > {
      const result =
        await pool.query<Record<string, unknown>>(
          text,
          [
            ...values,
          ],
        );

      return {
        rowCount: result.rowCount,
        rows: result.rows,
      };
    },
  };

function boundedText(
  value: unknown,
  maximumLength = MAX_EVIDENCE_TEXT_LENGTH,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value === value.trim()
  );
}

function nullableBoundedText(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    boundedText(value)
  );
}

function nonNegativeSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function nullableNonNegativeSafeInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    nonNegativeSafeInteger(value)
  );
}

function canonicalTimestamp(
  value: unknown,
): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    return false;
  }

  try {
    return (
      new Date(milliseconds).toISOString() ===
      value
    );
  } catch {
    return false;
  }
}

function nullableCanonicalTimestamp(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    canonicalTimestamp(value)
  );
}

function validStringList(
  value: unknown,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_CAPABILITY_COUNT &&
    value.every(
      (entry) =>
        boundedText(
          entry,
          MAX_IDENTIFIER_LENGTH,
        ),
    )
  );
}

function canonicalize(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    typeof value === 'object' &&
    value !== null
  ) {
    const source =
      value as Record<string, unknown>;

    const target:
      Record<string, unknown> = {};

    for (
      const key of Object.keys(source).sort()
    ) {
      const entry = source[key];

      if (entry !== undefined) {
        target[key] = canonicalize(entry);
      }
    }

    return target;
  }

  return value;
}

function sha256Digest(
  value: unknown,
): string {
  const serialized =
    JSON.stringify(canonicalize(value));

  if (typeof serialized !== 'string') {
    throw new Error(
      'Unable to serialize sanitized audit evidence',
    );
  }

  return (
    `sha256:${
      createHash('sha256')
        .update(serialized, 'utf8')
        .digest('hex')
    }`
  );
}

function validSanitizedEvidence(
  authorization:
    Phase6AgentRegistryConditionalGatingResultV1,
): boolean {
  const evidence = authorization.evidence;
  const registry = evidence.registryIdentity;
  const accountability = evidence.accountability;
  const binding = evidence.keyBinding;
  const card = evidence.agentCard;
  const capabilities = evidence.capabilities;
  const freshness = evidence.freshness;

  const contractValid =
    registry.contract === null ||
    (
      boundedText(
        registry.contract.index,
        MAX_IDENTIFIER_LENGTH,
      ) &&
      nonNegativeSafeInteger(
        registry.contract.subindex,
      )
    );

  return (
    nullableBoundedText(registry.network) &&
    contractValid &&
    nullableBoundedText(
      registry.moduleReference,
    ) &&
    nullableBoundedText(
      registry.agentTokenId,
    ) &&
    nullableBoundedText(
      registry.tokenAddress,
    ) &&
    nullableBoundedText(
      accountability.registryStatus,
    ) &&
    nullableBoundedText(
      accountability.ownerAccount,
    ) &&
    typeof accountability.ownerAccountBound ===
      'boolean' &&
    nullableBoundedText(
      accountability.ownerIdentityAssurance,
    ) &&
    typeof binding.required === 'boolean' &&
    typeof binding.verified === 'boolean' &&
    nullableBoundedText(
      binding.bindingType,
    ) &&
    nullableBoundedText(
      binding.keyFingerprint,
    ) &&
    nullableBoundedText(
      card.expectedHash,
    ) &&
    nullableBoundedText(
      card.actualHash,
    ) &&
    nullableNonNegativeSafeInteger(
      card.byteLength,
    ) &&
    typeof card.integrityVerified ===
      'boolean' &&
    validStringList(
      capabilities.required,
    ) &&
    validStringList(
      capabilities.satisfied,
    ) &&
    validStringList(
      capabilities.missing,
    ) &&
    typeof capabilities.policySatisfied ===
      'boolean' &&
    nullableBoundedText(
      freshness.source,
    ) &&
    nullableNonNegativeSafeInteger(
      freshness.finalizedBlockHeight,
    ) &&
    nullableBoundedText(
      freshness.finalizedBlockHash,
    ) &&
    nullableCanonicalTimestamp(
      freshness.observedAt,
    ) &&
    nullableNonNegativeSafeInteger(
      freshness.evidenceAgeSeconds,
    ) &&
    nullableNonNegativeSafeInteger(
      freshness.indexerLagBlocks,
    ) &&
    typeof freshness.revalidationRequired ===
      'boolean' &&
    typeof freshness.fresh === 'boolean'
  );
}

function sideEffectsRemainClosed(
  authorization:
    Phase6AgentRegistryConditionalGatingResultV1,
): boolean {
  return (
    authorization.buyerPolicyEvaluated ===
      false &&
    authorization.auditPersistenceAttempted ===
      false &&
    authorization.phase5StateMutated ===
      false &&
    authorization.canonicalStateMutated ===
      false &&
    authorization.boundedUseConsumed ===
      false &&
    authorization.replayStateMutated ===
      false &&
    authorization.ufxCalled === false &&
    authorization.crpCalled === false &&
    authorization.paymentAttempted ===
      false &&
    authorization.receiptIssued === false &&
    authorization.paymentResponseEmitted ===
      false &&
    authorization.resourceReleased ===
      false &&
    authorization.transactionSubmitted ===
      false &&
    authorization.signingKeyUsed === false &&
    authorization.productionActivation ===
      false
  );
}

function allowedFreshnessSourceLagProfile(
  freshness:
    Phase6AgentRegistryConditionalGatingResultV1[
      'evidence'
    ][
      'freshness'
    ],
): boolean {
  return (
    (
      freshness.source === 'direct_chain' &&
      freshness.indexerLagBlocks === null
    ) ||
    (
      (
        freshness.source === 'fixture' ||
        freshness.source ===
          'auditable_resolver'
      ) &&
      freshness.indexerLagBlocks === 0
    )
  );
}

function allowedEvidenceComplete(
  authorization:
    Phase6AgentRegistryConditionalGatingResultV1,
): boolean {
  const evidence = authorization.evidence;
  const registry = evidence.registryIdentity;
  const accountability = evidence.accountability;
  const binding = evidence.keyBinding;
  const card = evidence.agentCard;
  const capabilities = evidence.capabilities;
  const freshness = evidence.freshness;

  return (
    registry.network !== null &&
    registry.contract !== null &&
    registry.agentTokenId !== null &&
    registry.tokenAddress !== null &&
    accountability.registryStatus ===
      'Active' &&
    accountability.ownerAccount !== null &&
    accountability.ownerAccountBound ===
      true &&
    accountability.ownerIdentityAssurance ===
      'not_evaluated' &&
    freshness.finalizedBlockHeight !==
      null &&
    freshness.finalizedBlockHash !==
      null &&
    freshness.observedAt !== null &&
    freshness.evidenceAgeSeconds !==
      null &&
    allowedFreshnessSourceLagProfile(
      freshness,
    ) &&
    card.expectedHash !== null &&
    card.actualHash !== null &&
    card.expectedHash === card.actualHash &&
    card.byteLength !== null &&
    card.byteLength > 0 &&
    card.integrityVerified === true &&
    capabilities.required.length > 0 &&
    capabilities.missing.length === 0 &&
    capabilities.policySatisfied === true &&
    binding.required === true &&
    binding.verified === true &&
    binding.bindingType !== null &&
    binding.keyFingerprint !== null &&
    authorization.registryReadCaptured ===
      true
  );
}

function stringListsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value === right[index],
    )
  );
}

function positiveHandoffMatchesSanitizedEvidence(
  authorization:
    Phase6AgentRegistryConditionalGatingResultV1,
): boolean {
  const handoff =
    authorization.paymentEligibilityHandoff;

  if (handoff === null) {
    return false;
  }

  const evidence = authorization.evidence;
  const registry = evidence.registryIdentity;
  const accountability = evidence.accountability;
  const binding = evidence.keyBinding;
  const capabilities = evidence.capabilities;
  const freshness = evidence.freshness;
  const contract = registry.contract;

  if (contract === null) {
    return false;
  }

  return (
    handoff.type ===
      PHASE6_PAYMENT_ELIGIBILITY_HANDOFF_TYPE &&
    handoff.version ===
      AGENT_REGISTRY_CONTRACT_VERSION &&
    handoff.eligible === true &&
    handoff.decidedAt ===
      authorization.decidedAt &&

    handoff.registry.network ===
      registry.network &&
    handoff.registry.contract.index ===
      contract.index &&
    handoff.registry.contract.subindex ===
      contract.subindex &&
    handoff.registry.moduleReference ===
      registry.moduleReference &&
    handoff.registry.agentTokenId ===
      registry.agentTokenId &&
    handoff.registry.tokenAddress ===
      registry.tokenAddress &&

    handoff.registry.ownerAccount ===
      accountability.ownerAccount &&
    handoff.registry.ownerIdentityAssurance ===
      'not_evaluated' &&
    handoff.registry.ownerIdentityAssurance ===
      accountability.ownerIdentityAssurance &&

    handoff.registry.finalizedBlockHeight ===
      freshness.finalizedBlockHeight &&
    handoff.registry.finalizedBlockHash ===
      freshness.finalizedBlockHash &&
    handoff.registry.observedAt ===
      freshness.observedAt &&
    handoff.registry.evidenceAgeSeconds ===
      freshness.evidenceAgeSeconds &&

    handoff.keyBinding.bindingType ===
      binding.bindingType &&
    handoff.keyBinding.keyFingerprint ===
      binding.keyFingerprint &&

    stringListsEqual(
      handoff.capabilities.required,
      capabilities.required,
    ) &&
    stringListsEqual(
      handoff.capabilities.satisfied,
      capabilities.satisfied,
    ) &&

    handoff.paymentAttempted === false &&
    handoff.productionActivation === false
  );
}

function validAuthorizationContract(
  input:
    Phase6AgentRegistryAuthorizationAuditInsertInputV1,
): boolean {
  const authorization = input.authorization;

  if (
    !boundedText(
      input.challengeId,
      MAX_IDENTIFIER_LENGTH,
    ) ||
    !boundedText(
      input.nonce,
      MAX_IDENTIFIER_LENGTH,
    ) ||
    !boundedText(
      input.merchantId,
      MAX_IDENTIFIER_LENGTH,
    ) ||
    authorization.type !==
      PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_TYPE ||
    authorization.version !==
      AGENT_REGISTRY_CONTRACT_VERSION ||
    authorization.mode !==
      PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_MODE ||
    authorization.testOnly !== true ||
    !boundedText(
      authorization.reason,
      MAX_IDENTIFIER_LENGTH,
    ) ||
    !nullableCanonicalTimestamp(
      authorization.decidedAt,
    ) ||
    !validSanitizedEvidence(authorization) ||
    !sideEffectsRemainClosed(authorization)
  ) {
    return false;
  }

  if (authorization.status === 'allowed') {
    const handoff =
      authorization.paymentEligibilityHandoff;

    return (
      authorization.ok === true &&
      authorization.reason === 'accepted' &&
      authorization.phase5PreflightAccepted ===
        true &&
      handoff !== null &&
      handoff.eligible === true &&
      handoff.challenge.nonce ===
        input.nonce &&
      handoff.scope.merchantId ===
        input.merchantId &&
      allowedEvidenceComplete(authorization) &&
      positiveHandoffMatchesSanitizedEvidence(
        authorization,
      )
    );
  }

  if (
    authorization.ok !== false ||
    authorization.paymentEligibilityHandoff !==
      null
  ) {
    return false;
  }

  if (
    authorization.status ===
      'revalidation_required'
  ) {
    return (
      authorization.evidence.freshness
        .revalidationRequired === true
    );
  }

  return authorization.status === 'denied';
}

function hasRegistryEvidence(
  authorization:
    Phase6AgentRegistryConditionalGatingResultV1,
): boolean {
  const evidence = authorization.evidence;

  return (
    authorization.registryReadCaptured ||
    authorization.agentRegistryLookupAttempted ||
    authorization.registryNetworkCalled ||
    authorization.cis8LookupAttempted ||
    authorization.agentCardFetchAttempted ||
    authorization.agentCardNetworkCalled ||
    evidence.registryIdentity.network !== null ||
    evidence.registryIdentity.contract !== null ||
    evidence.registryIdentity.agentTokenId !==
      null ||
    evidence.accountability.ownerAccount !==
      null ||
    evidence.agentCard.expectedHash !== null ||
    evidence.keyBinding.keyFingerprint !== null
  );
}

function prepareAuditInsert(
  input:
    Phase6AgentRegistryAuthorizationAuditInsertInputV1,
): PreparedAuditInsertV1 | null {
  try {
    if (!validAuthorizationContract(input)) {
      return null;
    }

    const authorization = input.authorization;
    const evidence = authorization.evidence;

    const registryEvidenceHash =
      hasRegistryEvidence(authorization)
        ? sha256Digest({
            registryIdentity:
              evidence.registryIdentity,
            accountability:
              evidence.accountability,
            keyBinding:
              evidence.keyBinding,
            agentCard:
              evidence.agentCard,
            capabilities:
              evidence.capabilities,
            freshness:
              evidence.freshness,
          })
        : null;

    const authorizationEvidenceHash =
      sha256Digest({
        schemaVersion: 1,
        challengeId: input.challengeId,
        nonce: input.nonce,
        merchantId: input.merchantId,
        decision: authorization.status,
        reason: authorization.reason,
        decidedAt: authorization.decidedAt,
        phase5PreflightAccepted:
          authorization.phase5PreflightAccepted,
        registryEvidenceHash,
        registryReadCaptured:
          authorization.registryReadCaptured,
        lookupIndicators: {
          agentRegistryLookupAttempted:
            authorization
              .agentRegistryLookupAttempted,
          registryNetworkCalled:
            authorization.registryNetworkCalled,
          cis8LookupAttempted:
            authorization.cis8LookupAttempted,
          agentCardFetchAttempted:
            authorization.agentCardFetchAttempted,
          agentCardNetworkCalled:
            authorization.agentCardNetworkCalled,
        },
        paymentEligibility:
          authorization
            .paymentEligibilityHandoff === null
            ? null
            : {
                challenge:
                  authorization
                    .paymentEligibilityHandoff
                    .challenge,
                scope:
                  authorization
                    .paymentEligibilityHandoff
                    .scope,
                payment:
                  authorization
                    .paymentEligibilityHandoff
                    .payment,
              },
      });

    const contract =
      evidence.registryIdentity.contract;

    return {
      decision: authorization.status,
      registryEvidenceHash,
      authorizationEvidenceHash,

      values: [
        input.challengeId,
        input.nonce,
        input.merchantId,
        authorization.status,
        authorization.reason,

        evidence.registryIdentity.network,
        contract?.index ?? null,
        contract?.subindex ?? null,
        evidence.registryIdentity.moduleReference,
        evidence.registryIdentity.agentTokenId,
        evidence.registryIdentity.tokenAddress,

        evidence.accountability.registryStatus,
        evidence.accountability.ownerAccount,
        evidence.accountability.ownerAccountBound,
        evidence.accountability
          .ownerIdentityAssurance,

        evidence.freshness.finalizedBlockHeight,
        evidence.freshness.finalizedBlockHash,
        evidence.freshness.observedAt,
        evidence.freshness.evidenceAgeSeconds,
        evidence.freshness.indexerLagBlocks,

        evidence.agentCard.expectedHash,
        evidence.agentCard.actualHash,
        evidence.agentCard.byteLength,
        evidence.agentCard.integrityVerified,

        JSON.stringify(
          evidence.capabilities.required,
        ),
        JSON.stringify(
          evidence.capabilities.satisfied,
        ),
        JSON.stringify(
          evidence.capabilities.missing,
        ),
        evidence.capabilities.policySatisfied,

        evidence.keyBinding.required,
        evidence.keyBinding.verified,
        evidence.keyBinding.bindingType,
        evidence.keyBinding.keyFingerprint,

        registryEvidenceHash,
        authorizationEvidenceHash,

        authorization.registryReadCaptured,
        authorization.agentRegistryLookupAttempted,
        authorization.registryNetworkCalled,
        authorization.cis8LookupAttempted,
        authorization.agentCardFetchAttempted,
        authorization.agentCardNetworkCalled,

        authorization.buyerPolicyEvaluated,
        authorization.canonicalStateMutated,
        authorization.boundedUseConsumed,
        authorization.replayStateMutated,
        authorization.paymentAttempted,
        authorization.receiptIssued,
        authorization.resourceReleased,
        authorization.productionActivation,

        evidence.freshness.source,
      ],
    };
  } catch {
    return null;
  }
}

function timestampFromDatabase(
  value: unknown,
): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? value.toISOString()
      : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function auditIdFromDatabase(
  value: unknown,
): string | null {
  if (
    typeof value === 'string' &&
    /^[1-9][0-9]*$/.test(value)
  ) {
    return value;
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }

  if (
    typeof value === 'bigint' &&
    value > 0n
  ) {
    return value.toString();
  }

  return null;
}

function insertResult(
  options: {
    readonly ok: boolean;
    readonly reason:
      Phase6AgentRegistryAuthorizationAuditInsertReasonV1;
    readonly decision:
      Phase6AgentRegistryConditionalGatingStatusV1 | null;
    readonly auditPersisted: boolean;
    readonly persistenceAttempted: boolean;
    readonly databaseCalled: boolean;
    readonly auditId?: string | null;
    readonly recordedAt?: string | null;
    readonly registryEvidenceHash?: string | null;
    readonly authorizationEvidenceHash?: string | null;
  },
): Phase6AgentRegistryAuthorizationAuditInsertResultV1 {
  return {
    ok: options.ok,
    reason: options.reason,
    decision: options.decision,
    auditPersisted: options.auditPersisted,
    persistenceAttempted:
      options.persistenceAttempted,
    databaseCalled: options.databaseCalled,
    auditId: options.auditId ?? null,
    recordedAt: options.recordedAt ?? null,
    registryEvidenceHash:
      options.registryEvidenceHash ?? null,
    authorizationEvidenceHash:
      options.authorizationEvidenceHash ?? null,
    updateAttempted: false,
    deleteAttempted: false,
    rawMaterialPersisted: false,
    productionActivation: false,
  };
}

export async function persistPhase6AgentRegistryAuthorizationAuditV1(
  input:
    Phase6AgentRegistryAuthorizationAuditInsertInputV1,
  options:
    PersistPhase6AgentRegistryAuthorizationAuditOptionsV1 = {},
): Promise<
  Phase6AgentRegistryAuthorizationAuditInsertResultV1
> {
  const prepared = prepareAuditInsert(input);

  if (prepared === null) {
    return insertResult({
      ok: false,
      reason: 'invalid_audit_input',
      decision: null,
      auditPersisted: false,
      persistenceAttempted: false,
      databaseCalled: false,
    });
  }

  const executor =
    options.executor ?? defaultQueryExecutor;

  let queryResult:
    Phase6AgentRegistryAuthorizationAuditQueryResultV1;

  try {
    queryResult = await executor.query(
      PHASE6_AGENT_REGISTRY_AUTHORIZATION_AUDIT_INSERT_SQL,
      prepared.values,
    );
  } catch {
    return insertResult({
      ok: false,
      reason: 'database_error',
      decision: prepared.decision,
      auditPersisted: false,
      persistenceAttempted: true,
      databaseCalled: true,
      registryEvidenceHash:
        prepared.registryEvidenceHash,
      authorizationEvidenceHash:
        prepared.authorizationEvidenceHash,
    });
  }

  const row =
    queryResult.rowCount === 1
      ? queryResult.rows[0]
      : undefined;

  const auditId =
    auditIdFromDatabase(row?.audit_id);

  const recordedAt =
    timestampFromDatabase(row?.recorded_at);

  if (
    auditId === null ||
    recordedAt === null
  ) {
    return insertResult({
      ok: false,
      reason: 'insert_not_confirmed',
      decision: prepared.decision,
      auditPersisted: false,
      persistenceAttempted: true,
      databaseCalled: true,
      registryEvidenceHash:
        prepared.registryEvidenceHash,
      authorizationEvidenceHash:
        prepared.authorizationEvidenceHash,
    });
  }

  return insertResult({
    ok: true,
    reason: 'inserted',
    decision: prepared.decision,
    auditPersisted: true,
    persistenceAttempted: true,
    databaseCalled: true,
    auditId,
    recordedAt,
    registryEvidenceHash:
      prepared.registryEvidenceHash,
    authorizationEvidenceHash:
      prepared.authorizationEvidenceHash,
  });
}
