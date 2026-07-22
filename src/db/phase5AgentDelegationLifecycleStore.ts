import type {
  PoolClient,
} from 'pg';

import type {
  Phase5AgentDelegationLifecycleContract,
} from '../phase5/agentDelegationLifecycle';

import {
  pool,
} from './client';

export type Phase5AgentDelegationRevocationReason =
  | 'not_revoked'
  | 'delegation_revoked'
  | 'revocation_record_mismatch'
  | 'invalid_lifecycle_contract';

export type Phase5AgentDelegationRevocationResult = {
  readonly ok: boolean;
  readonly reason:
    Phase5AgentDelegationRevocationReason;

  readonly revocationChecked: boolean;
  readonly delegationRevoked: boolean;
  readonly lifecycleContractMatched: boolean;

  readonly revocationId: string | null;
  readonly delegationId: string | null;
  readonly credentialHash: string | null;

  readonly revokedAt: string | null;
  readonly revocationReasonCode: string | null;
};

export type Phase5AgentDelegationUseClaimReason =
  | 'claimed'
  | 'already_claimed'
  | 'delegation_revoked'
  | 'revocation_record_mismatch'
  | 'invalid_lifecycle_contract'
  | 'challenge_missing'
  | 'challenge_state_conflict'
  | 'usage_contract_mismatch'
  | 'delegation_use_exhausted'
  | 'claim_conflict'
  | 'claim_state_inconsistent';

export type Phase5AgentDelegationUseClaimResult = {
  readonly ok: boolean;
  readonly reason:
    Phase5AgentDelegationUseClaimReason;

  readonly revocationChecked: boolean;
  readonly delegationRevoked: boolean;
  readonly lifecycleContractMatched: boolean;

  readonly boundedUseChecked: boolean;
  readonly boundedUseConsumed: boolean;
  readonly usageClaimCreated: boolean;
  readonly usageClaimIdempotent: boolean;

  readonly policyStateMutated: boolean;

  readonly challengeId: string | null;
  readonly challengeNonce: string;
  readonly challengeState: string | null;

  readonly delegationId: string;
  readonly credentialHash: string;
  readonly revocationId: string;

  readonly usageCount: number | null;
  readonly maxUses: number;
  readonly useNumber: number | null;
};

export type ClaimPhase5AgentDelegationUseArgs =
  Phase5AgentDelegationLifecycleContract & {
    readonly nonce: string;
    readonly actor: string;
    readonly reasonCode: string;
    readonly reasonMessage: string;
  };

export type Phase5AgentDelegationUsageSnapshot =
  | {
      readonly found: false;
    }
  | {
      readonly found: true;
      readonly credentialHash: string;
      readonly delegationId: string;
      readonly revocationId: string;
      readonly buyerKeyVersion: number;
      readonly agentKeyVersion: number;
      readonly maxUses: number;
      readonly consumedUses: number;
      readonly claimCount: number;
    };

type RevocationRow = {
  revocation_id: string;
  delegation_id: string;
  credential_hash: string;
  revoked_at: Date | string;
  reason_code: string;
};

type UsageRow = {
  credential_hash: string;
  delegation_id: string;
  revocation_id: string;
  buyer_key_version: number | string;
  agent_key_version: number | string;
  max_uses: number | string;
  consumed_uses: number | string;
};

type ExistingClaimRow = UsageRow & {
  challenge_id: string;
  challenge_nonce: string;
  use_number: number | string;
};

const MAX_TRANSACTION_ATTEMPTS = 3;

function nonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0
  );
}

function positiveSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function validCredentialHash(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{64}$/.test(value)
  );
}

function validLifecycleContract(
  value:
    Phase5AgentDelegationLifecycleContract,
): boolean {
  return (
    nonEmptyString(value.delegationId) &&
    validCredentialHash(
      value.credentialHash,
    ) &&
    nonEmptyString(value.revocationId) &&
    positiveSafeInteger(
      value.buyerKeyVersion,
    ) &&
    positiveSafeInteger(
      value.agentKeyVersion,
    ) &&
    positiveSafeInteger(value.maxUses)
  );
}

function numberFromDatabase(
  value: number | string,
): number {
  return Math.trunc(Number(value));
}

function postgresErrorCode(
  error: unknown,
): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code === 'string'
  ) {
    return (
      error as {
        code: string;
      }
    ).code;
  }

  return null;
}

function retryableTransactionError(
  error: unknown,
): boolean {
  const code = postgresErrorCode(error);

  return (
    code === '40001' ||
    code === '40P01'
  );
}

async function rollbackQuietly(
  client: PoolClient,
): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

async function runSerializableTransaction<T>(
  operation: (
    client: PoolClient,
  ) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    const client = await pool.connect();

    try {
      await client.query(
        'BEGIN ISOLATION LEVEL SERIALIZABLE',
      );

      const result =
        await operation(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      lastError = error;

      await rollbackQuietly(client);

      if (
        retryableTransactionError(error) &&
        attempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    } finally {
      client.release();
    }
  }

  throw lastError;
}

async function selectRevocation(
  client: PoolClient,
  contract:
    Phase5AgentDelegationLifecycleContract,
  lock: boolean,
): Promise<RevocationRow | null> {
  const result =
    await client.query<RevocationRow>(
      `
      SELECT
        revocation_id,
        delegation_id,
        credential_hash,
        revoked_at,
        reason_code
      FROM phase5_agent_delegation_revocations
      WHERE revocation_id = $1
      ${lock ? 'FOR SHARE' : ''}
      `,
      [
        contract.revocationId,
      ],
    );

  return (
    result.rowCount === 1
      ? result.rows[0]
      : null
  );
}

function evaluateRevocationRow(
  contract:
    Phase5AgentDelegationLifecycleContract,
  row: RevocationRow | null,
): Phase5AgentDelegationRevocationResult {
  if (!validLifecycleContract(contract)) {
    return {
      ok: false,
      reason:
        'invalid_lifecycle_contract',

      revocationChecked: false,
      delegationRevoked: false,
      lifecycleContractMatched: false,

      revocationId: null,
      delegationId: null,
      credentialHash: null,

      revokedAt: null,
      revocationReasonCode: null,
    };
  }

  if (row === null) {
    return {
      ok: true,
      reason: 'not_revoked',

      revocationChecked: true,
      delegationRevoked: false,
      lifecycleContractMatched: true,

      revocationId:
        contract.revocationId,

      delegationId:
        contract.delegationId,

      credentialHash:
        contract.credentialHash,

      revokedAt: null,
      revocationReasonCode: null,
    };
  }

  const lifecycleContractMatched =
    row.revocation_id ===
      contract.revocationId &&
    row.delegation_id ===
      contract.delegationId &&
    row.credential_hash ===
      contract.credentialHash;

  if (!lifecycleContractMatched) {
    return {
      ok: false,
      reason:
        'revocation_record_mismatch',

      revocationChecked: true,
      delegationRevoked: false,
      lifecycleContractMatched: false,

      revocationId:
        row.revocation_id,

      delegationId:
        row.delegation_id,

      credentialHash:
        row.credential_hash,

      revokedAt:
        new Date(row.revoked_at)
          .toISOString(),

      revocationReasonCode:
        row.reason_code,
    };
  }

  return {
    ok: false,
    reason: 'delegation_revoked',

    revocationChecked: true,
    delegationRevoked: true,
    lifecycleContractMatched: true,

    revocationId:
      row.revocation_id,

    delegationId:
      row.delegation_id,

    credentialHash:
      row.credential_hash,

    revokedAt:
      new Date(row.revoked_at)
        .toISOString(),

    revocationReasonCode:
      row.reason_code,
  };
}

function usageContractMatches(
  row: UsageRow,
  contract:
    Phase5AgentDelegationLifecycleContract,
): boolean {
  return (
    row.credential_hash ===
      contract.credentialHash &&
    row.delegation_id ===
      contract.delegationId &&
    row.revocation_id ===
      contract.revocationId &&
    numberFromDatabase(
      row.buyer_key_version,
    ) === contract.buyerKeyVersion &&
    numberFromDatabase(
      row.agent_key_version,
    ) === contract.agentKeyVersion &&
    numberFromDatabase(
      row.max_uses,
    ) === contract.maxUses
  );
}

function claimResult(
  args:
    ClaimPhase5AgentDelegationUseArgs,
  values: {
    ok: boolean;
    reason:
      Phase5AgentDelegationUseClaimReason;

    revocationChecked?: boolean;
    delegationRevoked?: boolean;
    lifecycleContractMatched?: boolean;

    boundedUseChecked?: boolean;
    boundedUseConsumed?: boolean;
    usageClaimCreated?: boolean;
    usageClaimIdempotent?: boolean;

    policyStateMutated?: boolean;

    challengeId?: string | null;
    challengeState?: string | null;

    usageCount?: number | null;
    useNumber?: number | null;
  },
): Phase5AgentDelegationUseClaimResult {
  return {
    ok: values.ok,
    reason: values.reason,

    revocationChecked:
      values.revocationChecked ??
      false,

    delegationRevoked:
      values.delegationRevoked ??
      false,

    lifecycleContractMatched:
      values.lifecycleContractMatched ??
      false,

    boundedUseChecked:
      values.boundedUseChecked ??
      false,

    boundedUseConsumed:
      values.boundedUseConsumed ??
      false,

    usageClaimCreated:
      values.usageClaimCreated ??
      false,

    usageClaimIdempotent:
      values.usageClaimIdempotent ??
      false,

    policyStateMutated:
      values.policyStateMutated ??
      false,

    challengeId:
      values.challengeId ??
      null,

    challengeNonce:
      args.nonce,

    challengeState:
      values.challengeState ??
      null,

    delegationId:
      args.delegationId,

    credentialHash:
      args.credentialHash,

    revocationId:
      args.revocationId,

    usageCount:
      values.usageCount ??
      null,

    maxUses:
      args.maxUses,

    useNumber:
      values.useNumber ??
      null,
  };
}

export async function checkPhase5AgentDelegationRevocation(
  contract:
    Phase5AgentDelegationLifecycleContract,
): Promise<
  Phase5AgentDelegationRevocationResult
> {
  if (!validLifecycleContract(contract)) {
    return evaluateRevocationRow(
      contract,
      null,
    );
  }

  /*
   * Final-acceptance failure injection.
   *
   * Disabled unless both the explicit test-only flag and
   * exact target delegation ID are supplied. The failure
   * occurs before any database connection or mutation.
   */
  const storeFailureTestOnlyEnabled =
    String(
      process.env
        .PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY ??
        '',
    ).toLowerCase() === 'true';

  const storeFailureTestOnlyDelegationId =
    String(
      process.env
        .PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY_DELEGATION_ID ??
        '',
    );

  if (
    storeFailureTestOnlyEnabled &&
    storeFailureTestOnlyDelegationId.length > 0 &&
    contract.delegationId ===
      storeFailureTestOnlyDelegationId
  ) {
    throw new Error(
      'Phase 5 lifecycle store failure test-only injection.',
    );
  }

  const client = await pool.connect();

  try {
    const row =
      await selectRevocation(
        client,
        contract,
        false,
      );

    return evaluateRevocationRow(
      contract,
      row,
    );
  } finally {
    client.release();
  }
}

export async function claimPhase5AgentDelegationUseAndPersistPolicySatisfied(
  args:
    ClaimPhase5AgentDelegationUseArgs,
): Promise<
  Phase5AgentDelegationUseClaimResult
> {
  if (
    !validLifecycleContract(args) ||
    !nonEmptyString(args.nonce) ||
    !nonEmptyString(args.actor) ||
    !nonEmptyString(args.reasonCode) ||
    !nonEmptyString(args.reasonMessage)
  ) {
    return claimResult(args, {
      ok: false,
      reason:
        'invalid_lifecycle_contract',
    });
  }

  return runSerializableTransaction(
    async (client) => {
      const challenge =
        await client.query<{
          challenge_id: string;
          status: string;
        }>(
          `
          SELECT
            challenge_id,
            status
          FROM payment_challenges
          WHERE nonce = $1
          FOR UPDATE
          `,
          [
            args.nonce,
          ],
        );

      if (challenge.rowCount !== 1) {
        return claimResult(args, {
          ok: false,
          reason: 'challenge_missing',
        });
      }

      const challengeId =
        challenge.rows[0].challenge_id;

      const challengeState =
        challenge.rows[0].status;

      const revocationRow =
        await selectRevocation(
          client,
          args,
          true,
        );

      const revocation =
        evaluateRevocationRow(
          args,
          revocationRow,
        );

      if (!revocation.ok) {
        const claimReason:
          Phase5AgentDelegationUseClaimReason =
          revocation.reason ===
            'delegation_revoked'
            ? 'delegation_revoked'
            : revocation.reason ===
                'revocation_record_mismatch'
              ? 'revocation_record_mismatch'
              : 'invalid_lifecycle_contract';

        return claimResult(args, {
          ok: false,
          reason: claimReason,

          revocationChecked:
            revocation.revocationChecked,

          delegationRevoked:
            revocation.delegationRevoked,

          lifecycleContractMatched:
            revocation
              .lifecycleContractMatched,

          challengeId,
          challengeState,
        });
      }

      const existingClaim =
        await client.query<
          ExistingClaimRow
        >(
          `
          SELECT
            claims.challenge_id,
            claims.challenge_nonce,
            claims.use_number,

            usage.credential_hash,
            usage.delegation_id,
            usage.revocation_id,
            usage.buyer_key_version,
            usage.agent_key_version,
            usage.max_uses,
            usage.consumed_uses
          FROM phase5_agent_delegation_use_claims
            AS claims
          JOIN phase5_agent_delegation_usage
            AS usage
            ON usage.credential_hash =
              claims.credential_hash
          WHERE claims.challenge_nonce = $1
          FOR UPDATE OF claims, usage
          `,
          [
            args.nonce,
          ],
        );

      if (existingClaim.rowCount === 1) {
        const row =
          existingClaim.rows[0];

        const claimMatches =
          row.challenge_id ===
            challengeId &&
          row.challenge_nonce ===
            args.nonce &&
          usageContractMatches(
            row,
            args,
          );

        if (!claimMatches) {
          return claimResult(args, {
            ok: false,
            reason: 'claim_conflict',

            revocationChecked: true,
            lifecycleContractMatched:
              false,

            boundedUseChecked: true,

            challengeId,
            challengeState,

            usageCount:
              numberFromDatabase(
                row.consumed_uses,
              ),

            useNumber:
              numberFromDatabase(
                row.use_number,
              ),
          });
        }

        if (
          challengeState !==
          'POLICY_SATISFIED'
        ) {
          return claimResult(args, {
            ok: false,
            reason:
              'claim_state_inconsistent',

            revocationChecked: true,
            lifecycleContractMatched:
              true,

            boundedUseChecked: true,

            challengeId,
            challengeState,

            usageCount:
              numberFromDatabase(
                row.consumed_uses,
              ),

            useNumber:
              numberFromDatabase(
                row.use_number,
              ),
          });
        }

        return claimResult(args, {
          ok: true,
          reason: 'already_claimed',

          revocationChecked: true,
          lifecycleContractMatched:
            true,

          boundedUseChecked: true,
          boundedUseConsumed: true,
          usageClaimCreated: false,
          usageClaimIdempotent: true,

          policyStateMutated: false,

          challengeId,
          challengeState,

          usageCount:
            numberFromDatabase(
              row.consumed_uses,
            ),

          useNumber:
            numberFromDatabase(
              row.use_number,
            ),
        });
      }

      if (challengeState !== 'ISSUED') {
        return claimResult(args, {
          ok: false,
          reason:
            'challenge_state_conflict',

          revocationChecked: true,
          lifecycleContractMatched:
            true,

          challengeId,
          challengeState,
        });
      }

      await client.query(
        `
        INSERT INTO phase5_agent_delegation_usage (
          credential_hash,
          delegation_id,
          revocation_id,
          buyer_key_version,
          agent_key_version,
          max_uses,
          consumed_uses
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 0
        )
        ON CONFLICT (credential_hash)
          DO NOTHING
        `,
        [
          args.credentialHash,
          args.delegationId,
          args.revocationId,
          args.buyerKeyVersion,
          args.agentKeyVersion,
          args.maxUses,
        ],
      );

      const usage =
        await client.query<UsageRow>(
          `
          SELECT
            credential_hash,
            delegation_id,
            revocation_id,
            buyer_key_version,
            agent_key_version,
            max_uses,
            consumed_uses
          FROM phase5_agent_delegation_usage
          WHERE credential_hash = $1
          FOR UPDATE
          `,
          [
            args.credentialHash,
          ],
        );

      if (
        usage.rowCount !== 1 ||
        !usageContractMatches(
          usage.rows[0],
          args,
        )
      ) {
        return claimResult(args, {
          ok: false,
          reason:
            'usage_contract_mismatch',

          revocationChecked: true,
          lifecycleContractMatched:
            false,

          boundedUseChecked: true,

          challengeId,
          challengeState,

          usageCount:
            usage.rowCount === 1
              ? numberFromDatabase(
                  usage.rows[0]
                    .consumed_uses,
                )
              : null,
        });
      }

      const consumedUses =
        numberFromDatabase(
          usage.rows[0].consumed_uses,
        );

      if (
        consumedUses >=
        args.maxUses
      ) {
        return claimResult(args, {
          ok: false,
          reason:
            'delegation_use_exhausted',

          revocationChecked: true,
          lifecycleContractMatched:
            true,

          boundedUseChecked: true,

          challengeId,
          challengeState,

          usageCount:
            consumedUses,
        });
      }

      const nextUseNumber =
        consumedUses + 1;

      await client.query(
        `
        INSERT INTO phase5_agent_delegation_use_claims (
          credential_hash,
          challenge_id,
          challenge_nonce,
          use_number
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          args.credentialHash,
          challengeId,
          args.nonce,
          nextUseNumber,
        ],
      );

      const usageUpdate =
        await client.query(
          `
          UPDATE phase5_agent_delegation_usage
          SET
            consumed_uses = $2,
            updated_at = now()
          WHERE credential_hash = $1
            AND consumed_uses = $3
          `,
          [
            args.credentialHash,
            nextUseNumber,
            consumedUses,
          ],
        );

      if (usageUpdate.rowCount !== 1) {
        throw new Error(
          'Phase 5 delegation usage counter update failed.',
        );
      }

      const challengeUpdate =
        await client.query(
          `
          UPDATE payment_challenges
          SET
            status = 'POLICY_SATISFIED',
            updated_at = now()
          WHERE challenge_id = $1
            AND status = 'ISSUED'
          `,
          [
            challengeId,
          ],
        );

      if (challengeUpdate.rowCount !== 1) {
        throw new Error(
          'Phase 5 canonical challenge transition failed.',
        );
      }

      await client.query(
        `
        INSERT INTO gateway_state_transitions (
          challenge_id,
          from_state,
          to_state,
          actor,
          reason_code,
          reason_message
        )
        VALUES (
          $1,
          'ISSUED',
          'POLICY_SATISFIED',
          $2,
          $3,
          $4
        )
        `,
        [
          challengeId,
          args.actor,
          args.reasonCode,
          args.reasonMessage,
        ],
      );

      return claimResult(args, {
        ok: true,
        reason: 'claimed',

        revocationChecked: true,
        lifecycleContractMatched:
          true,

        boundedUseChecked: true,
        boundedUseConsumed: true,
        usageClaimCreated: true,
        usageClaimIdempotent: false,

        policyStateMutated: true,

        challengeId,
        challengeState:
          'POLICY_SATISFIED',

        usageCount:
          nextUseNumber,

        useNumber:
          nextUseNumber,
      });
    },
  );
}

export async function getPhase5AgentDelegationUsageSnapshot(
  credentialHash: string,
): Promise<
  Phase5AgentDelegationUsageSnapshot
> {
  const result =
    await pool.query<
      UsageRow & {
        claim_count: number | string;
      }
    >(
      `
      SELECT
        usage.credential_hash,
        usage.delegation_id,
        usage.revocation_id,
        usage.buyer_key_version,
        usage.agent_key_version,
        usage.max_uses,
        usage.consumed_uses,
        COUNT(claims.claim_id)
          AS claim_count
      FROM phase5_agent_delegation_usage
        AS usage
      LEFT JOIN phase5_agent_delegation_use_claims
        AS claims
        ON claims.credential_hash =
          usage.credential_hash
      WHERE usage.credential_hash = $1
      GROUP BY
        usage.credential_hash,
        usage.delegation_id,
        usage.revocation_id,
        usage.buyer_key_version,
        usage.agent_key_version,
        usage.max_uses,
        usage.consumed_uses
      `,
      [
        credentialHash,
      ],
    );

  if (result.rowCount !== 1) {
    return {
      found: false,
    };
  }

  const row = result.rows[0];

  return {
    found: true,

    credentialHash:
      row.credential_hash,

    delegationId:
      row.delegation_id,

    revocationId:
      row.revocation_id,

    buyerKeyVersion:
      numberFromDatabase(
        row.buyer_key_version,
      ),

    agentKeyVersion:
      numberFromDatabase(
        row.agent_key_version,
      ),

    maxUses:
      numberFromDatabase(
        row.max_uses,
      ),

    consumedUses:
      numberFromDatabase(
        row.consumed_uses,
      ),

    claimCount:
      numberFromDatabase(
        row.claim_count,
      ),
  };
}
