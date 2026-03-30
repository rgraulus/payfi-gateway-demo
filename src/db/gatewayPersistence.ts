import { createHash } from 'crypto';

import type { ContractDefinition } from '../contracts';
import { pool } from './client';

type PersistIssuedChallengeArgs = {
  contract: ContractDefinition;
  nonce: string;
  paymentRequiredHeaderPayload: {
    issuedAt: number;
    expiresAt: number;
    [key: string]: unknown;
  };
};

type TransitionChallengeStateArgs = {
  nonce: string;
  fromState: string;
  toState: string;
  actor: string;
  reasonCode: string;
  reasonMessage: string;
};

type CompleteSourceVerificationArgs = {
  nonce: string;
  outcome: 'verified' | 'failed';
  actor: string;
  reasonCode: string;
  reasonMessage: string;
};

type CompletePolicyEvaluationArgs = {
  nonce: string;
  actor: string;
  reasonCode: string;
  reasonMessage: string;
};

type CompleteSettlementEntryArgs = {
  nonce: string;
  actor: string;
  requestedReasonCode: string;
  requestedReasonMessage: string;
  pendingReasonCode: string;
  pendingReasonMessage: string;
};

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function computeResourceHash(method: string, path: string): string {
  return sha256Hex(`${method.toUpperCase()} ${path}`);
}

function computePaymentRequestHash(payload: unknown): string {
  return sha256Hex(JSON.stringify(payload));
}

function computeIdempotencyKey(args: {
  merchantId: string;
  resourceHash: string;
  nonce: string;
}): string {
  return `${args.merchantId}:${args.resourceHash}:${args.nonce}`;
}

function buildContractSnapshot(contract: ContractDefinition): Record<string, unknown> {
  return {
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    isFrozen: contract.isFrozen,
    merchantId: contract.merchantId,
    resource: contract.resource,
    network: contract.network,
    asset: contract.asset,
    amount: contract.amount,
    payTo: contract.payTo,
    mode: contract.mode ?? 'local',
    upstream: contract.upstream ?? null,
    attestations: contract.attestations ?? [],
  };
}

export async function persistIssuedChallenge(
  args: PersistIssuedChallengeArgs,
): Promise<void> {
  const { contract, nonce, paymentRequiredHeaderPayload } = args;

  const resourceHash = computeResourceHash(
    contract.resource.method,
    contract.resource.path,
  );

  const paymentRequestHash = computePaymentRequestHash(paymentRequiredHeaderPayload);

  const idempotencyKey = computeIdempotencyKey({
    merchantId: contract.merchantId,
    resourceHash,
    nonce,
  });

  const contractSnapshot = buildContractSnapshot(contract);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertChallenge = await client.query<{
      challenge_id: string;
    }>(
      `
      INSERT INTO payment_challenges (
        merchant_id,
        nonce,
        resource_hash,
        contract_id,
        contract_version,
        contract_snapshot,
        payment_request_hash,
        status,
        release_status,
        payment_mode,
        network,
        asset,
        amount,
        pay_to,
        idempotency_key,
        issued_at,
        expires_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15,
        to_timestamp($16),
        to_timestamp($17)
      )
      ON CONFLICT (nonce) DO NOTHING
      RETURNING challenge_id
      `,
      [
        contract.merchantId,
        nonce,
        resourceHash,
        contract.contractId,
        contract.contractVersion,
        JSON.stringify(contractSnapshot),
        paymentRequestHash,
        'ISSUED',
        'NOT_RELEASED',
        'native_concordium',
        contract.network,
        JSON.stringify(contract.asset),
        String(contract.amount),
        contract.payTo,
        idempotencyKey,
        paymentRequiredHeaderPayload.issuedAt,
        paymentRequiredHeaderPayload.expiresAt,
      ],
    );

    if (insertChallenge.rowCount === 1) {
      const challengeId = insertChallenge.rows[0].challenge_id;

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
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          challengeId,
          null,
          'ISSUED',
          'gateway',
          'challenge_issued',
          'Canonical payment challenge issued by gateway',
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionChallengeStateByNonce(
  args: TransitionChallengeStateArgs,
): Promise<{
  updated: boolean;
  reason:
    | 'updated'
    | 'missing'
    | 'already_in_target'
    | 'unexpected_state';
  challengeId?: string;
  currentState?: string;
}> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{
      challenge_id: string;
      status: string;
    }>(
      `
      SELECT challenge_id, status
      FROM payment_challenges
      WHERE nonce = $1
      FOR UPDATE
      `,
      [args.nonce],
    );

    if (existing.rowCount !== 1) {
      await client.query('ROLLBACK');
      return { updated: false, reason: 'missing' };
    }

    const row = existing.rows[0];
    const challengeId = row.challenge_id;
    const currentState = row.status;

    if (currentState === args.toState) {
      await client.query('ROLLBACK');
      return {
        updated: false,
        reason: 'already_in_target',
        challengeId,
        currentState,
      };
    }

    if (currentState !== args.fromState) {
      await client.query('ROLLBACK');
      return {
        updated: false,
        reason: 'unexpected_state',
        challengeId,
        currentState,
      };
    }

    await client.query(
      `
      UPDATE payment_challenges
      SET status = $2,
          updated_at = now()
      WHERE challenge_id = $1
      `,
      [challengeId, args.toState],
    );

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
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        challengeId,
        args.fromState,
        args.toState,
        args.actor,
        args.reasonCode,
        args.reasonMessage,
      ],
    );

    await client.query('COMMIT');

    return {
      updated: true,
      reason: 'updated',
      challengeId,
      currentState: args.toState,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeSourceVerificationByNonce(
  args: CompleteSourceVerificationArgs,
): Promise<{
  updated: boolean;
  reason:
    | 'updated'
    | 'missing'
    | 'already_in_target'
    | 'unexpected_state';
  challengeId?: string;
  currentState?: string;
}> {
  const toState =
    args.outcome === 'verified' ? 'SOURCE_VERIFIED' : 'SOURCE_VERIFY_FAILED';

  return transitionChallengeStateByNonce({
    nonce: args.nonce,
    fromState: 'SOURCE_VERIFY_PENDING',
    toState,
    actor: args.actor,
    reasonCode: args.reasonCode,
    reasonMessage: args.reasonMessage,
  });
}

export async function completePolicyEvaluationByNonce(
  args: CompletePolicyEvaluationArgs,
): Promise<{
  updated: boolean;
  reason:
    | 'updated'
    | 'missing'
    | 'already_in_target'
    | 'unexpected_state';
  challengeId?: string;
  currentState?: string;
}> {
  return transitionChallengeStateByNonce({
    nonce: args.nonce,
    fromState: 'SOURCE_VERIFIED',
    toState: 'POLICY_SATISFIED',
    actor: args.actor,
    reasonCode: args.reasonCode,
    reasonMessage: args.reasonMessage,
  });
}

export async function completeSettlementEntryByNonce(
  args: CompleteSettlementEntryArgs,
): Promise<{
  updated: boolean;
  reason:
    | 'updated'
    | 'missing'
    | 'already_in_target'
    | 'unexpected_state';
  challengeId?: string;
  currentState?: string;
}> {
  const requested = await transitionChallengeStateByNonce({
    nonce: args.nonce,
    fromState: 'POLICY_SATISFIED',
    toState: 'SETTLEMENT_REQUESTED',
    actor: args.actor,
    reasonCode: args.requestedReasonCode,
    reasonMessage: args.requestedReasonMessage,
  });

  if (!requested.updated) {
    return requested;
  }

  return transitionChallengeStateByNonce({
    nonce: args.nonce,
    fromState: 'SETTLEMENT_REQUESTED',
    toState: 'SETTLEMENT_PENDING',
    actor: args.actor,
    reasonCode: args.pendingReasonCode,
    reasonMessage: args.pendingReasonMessage,
  });
}

