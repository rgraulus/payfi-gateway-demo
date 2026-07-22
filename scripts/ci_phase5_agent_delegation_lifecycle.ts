import assert from 'node:assert/strict';
import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  Client,
} from 'pg';

import {
  pool,
} from '../src/db/client';

import {
  evaluatePhase5AgentDelegationLifecycle,
  type Phase5AgentDelegationLifecycleContract,
} from '../src/phase5/agentDelegationLifecycle';

import type {
  AgentProofOfPossessionVerificationResult,
} from '../src/phase5/agentProofOfPossessionVerifier';

import type {
  Phase5AgentCryptographicBindingResult,
} from '../src/phase5/agentCryptographicDelegationBindingVerifier';

import {
  checkPhase5AgentDelegationRevocation,
  claimPhase5AgentDelegationUseAndPersistPolicySatisfied,
  getPhase5AgentDelegationUsageSnapshot,
} from '../src/db/phase5AgentDelegationLifecycleStore';

const LABEL =
  'phase5:agent-delegation-lifecycle-test';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://postgres:pg@127.0.0.1:5432/transaction-outcome';

const RUN_ID =
  randomUUID()
    .replace(/-/g, '')
    .slice(0, 16);

const PREFIX =
  `pr297-${RUN_ID}`;

const NOW_SEC =
  Math.floor(Date.now() / 1000);

type CaseResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly reason: string;
};

const results: CaseResult[] = [];

function sha256Hex(
  value: string,
): string {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function record(
  name: string,
  reason: string,
): void {
  results.push({
    name,
    passed: true,
    reason,
  });

  console.log(
    `PASS | ${name} | ${reason}`,
  );
}

function lifecycleContract(
  suffix: string,
  maxUses = 1,
): Phase5AgentDelegationLifecycleContract {
  const delegationId =
    `${PREFIX}-delegation-${suffix}`;

  return {
    delegationId,

    credentialHash:
      sha256Hex(
        `${PREFIX}:credential:${suffix}`,
      ),

    revocationId:
      `${PREFIX}-revocation-${suffix}`,

    buyerKeyVersion: 1,
    agentKeyVersion: 1,
    maxUses,
  };
}

function delegationDocument(
  contract:
    Phase5AgentDelegationLifecycleContract,
  options: {
    notBeforeSec?: number;
    expiresAtSec?: number;
    maxUses?: number;
    revocationId?: string;
    buyerKeyVersion?: number;
    agentKeyVersion?: number;
  } = {},
): unknown {
  return {
    credential: {
      delegationId:
        contract.delegationId,

      validity: {
        issuedAt:
          NOW_SEC - 60,

        notBefore:
          options.notBeforeSec ??
          NOW_SEC - 30,

        expiresAt:
          options.expiresAtSec ??
          NOW_SEC + 600,
      },

      usage: {
        maxUses:
          options.maxUses ??
          contract.maxUses,
      },

      lifecycle: {
        revocationId:
          options.revocationId ??
          contract.revocationId,

        buyerKeyVersion:
          options.buyerKeyVersion ??
          contract.buyerKeyVersion,

        agentKeyVersion:
          options.agentKeyVersion ??
          contract.agentKeyVersion,
      },
    },
  };
}

function acceptedProof(
  contract:
    Phase5AgentDelegationLifecycleContract,
): AgentProofOfPossessionVerificationResult {
  return {
    ok: true,
    delegationContractValidated: true,
    buyerSignatureVerified: true,
    agentPublicKeyBoundByBuyerSignature: true,
    agentProofOfPossessionVerified: true,
    credentialHash:
      contract.credentialHash,
    delegationId:
      contract.delegationId,
  } as unknown as
    AgentProofOfPossessionVerificationResult;
}

function acceptedBinding(
  contract:
    Phase5AgentDelegationLifecycleContract,
): Phase5AgentCryptographicBindingResult {
  return {
    ok: true,
    cryptographicDelegationVerification: true,
    buyerSignatureVerified: true,
    agentProofOfPossessionVerified: true,
    verifiedDelegationDocumentMatched: true,
    outerDelegationIdentityBound: true,
    buyerPolicySubjectBound: true,
    signedScopeBound: true,
    signedPaymentTupleBound: true,
    credentialValidityCoversChallenge: true,
    signedUsageBound: true,
    signedReplayBound: true,
    credentialHash:
      contract.credentialHash,
    delegationId:
      contract.delegationId,
  } as unknown as
    Phase5AgentCryptographicBindingResult;
}

async function insertChallenge(
  client: Client,
  nonce: string,
  status = 'ISSUED',
): Promise<void> {
  const resourceHash =
    sha256Hex(
      `GET /paid-gated:${nonce}`,
    );

  const paymentRequestHash =
    sha256Hex(
      `payment-request:${nonce}`,
    );

  const idempotencyKey =
    `${PREFIX}:idempotency:${nonce}`;

  await client.query(
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
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      $7,
      $8,
      'NOT_RELEASED',
      'native_concordium',
      'concordium:testnet',
      $9::jsonb,
      '0.050101',
      'pr297-test-pay-to',
      $10,
      to_timestamp($11),
      to_timestamp($12)
    )
    `,
    [
      'pr297-test-merchant',
      nonce,
      resourceHash,
      'pr297-test-contract',
      '1.0.0',
      JSON.stringify({
        testOnly: true,
        runId: RUN_ID,
      }),
      paymentRequestHash,
      status,
      JSON.stringify({
        type: 'plt',
        tokenId: 'EUDemo',
        decimals: 6,
      }),
      idempotencyKey,
      NOW_SEC - 30,
      NOW_SEC + 600,
    ],
  );
}

async function insertRevocation(
  client: Client,
  contract:
    Phase5AgentDelegationLifecycleContract,
  options: {
    delegationId?: string;
    credentialHash?: string;
    reasonCode?: string;
  } = {},
): Promise<void> {
  await client.query(
    `
    INSERT INTO phase5_agent_delegation_revocations (
      revocation_id,
      delegation_id,
      credential_hash,
      reason_code,
      reason_message,
      metadata
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb
    )
    `,
    [
      contract.revocationId,

      options.delegationId ??
      contract.delegationId,

      options.credentialHash ??
      contract.credentialHash,

      options.reasonCode ??
      'test_revocation',

      'PR #297 isolated lifecycle harness.',

      JSON.stringify({
        testOnly: true,
        runId: RUN_ID,
      }),
    ],
  );
}

async function seedUsageMismatch(
  client: Client,
  contract:
    Phase5AgentDelegationLifecycleContract,
): Promise<void> {
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
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      0
    )
    `,
    [
      contract.credentialHash,
      contract.delegationId,
      contract.revocationId,
      contract.buyerKeyVersion,
      contract.agentKeyVersion,
      contract.maxUses + 1,
    ],
  );
}

async function challengeState(
  client: Client,
  nonce: string,
): Promise<string | null> {
  const result =
    await client.query<{
      status: string;
    }>(
      `
      SELECT status
      FROM payment_challenges
      WHERE nonce = $1
      `,
      [nonce],
    );

  return (
    result.rowCount === 1
      ? result.rows[0].status
      : null
  );
}

async function transitionCount(
  client: Client,
  nonce: string,
): Promise<number> {
  const result =
    await client.query<{
      count: number | string;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM gateway_state_transitions
      WHERE challenge_id = (
        SELECT challenge_id
        FROM payment_challenges
        WHERE nonce = $1
      )
        AND from_state = 'ISSUED'
        AND to_state = 'POLICY_SATISFIED'
      `,
      [nonce],
    );

  return Math.trunc(
    Number(result.rows[0].count),
  );
}

async function cleanup(
  client: Client,
): Promise<void> {
  await client.query(
    `
    DELETE FROM payment_challenges
    WHERE nonce LIKE $1
    `,
    [`${PREFIX}%`],
  );

  await client.query(
    `
    DELETE FROM phase5_agent_delegation_usage
    WHERE delegation_id LIKE $1
    `,
    [`${PREFIX}%`],
  );

  await client.query(
    `
    DELETE FROM phase5_agent_delegation_revocations
    WHERE revocation_id LIKE $1
       OR delegation_id LIKE $1
    `,
    [`${PREFIX}%`],
  );
}

async function residueCounts(
  client: Client,
): Promise<{
  challenges: number;
  revocations: number;
  usage: number;
  claims: number;
}> {
  const result =
    await client.query<{
      challenges: number | string;
      revocations: number | string;
      usage: number | string;
      claims: number | string;
    }>(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM payment_challenges
          WHERE nonce LIKE $1
        ) AS challenges,

        (
          SELECT COUNT(*)
          FROM phase5_agent_delegation_revocations
          WHERE revocation_id LIKE $1
             OR delegation_id LIKE $1
        ) AS revocations,

        (
          SELECT COUNT(*)
          FROM phase5_agent_delegation_usage
          WHERE delegation_id LIKE $1
        ) AS usage,

        (
          SELECT COUNT(*)
          FROM phase5_agent_delegation_use_claims
          WHERE challenge_nonce LIKE $1
        ) AS claims
      `,
      [`${PREFIX}%`],
    );

  const row = result.rows[0];

  return {
    challenges:
      Math.trunc(Number(row.challenges)),

    revocations:
      Math.trunc(Number(row.revocations)),

    usage:
      Math.trunc(Number(row.usage)),

    claims:
      Math.trunc(Number(row.claims)),
  };
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  await client.connect();

  try {
    await cleanup(client);

    const pureContract =
      lifecycleContract('pure');

    const valid =
      evaluatePhase5AgentDelegationLifecycle({
        delegationDocument:
          delegationDocument(pureContract),

        proofVerification:
          acceptedProof(pureContract),

        cryptographicBinding:
          acceptedBinding(pureContract),

        nowSec: NOW_SEC,
      });

    assert.equal(valid.ok, true);
    assert.equal(
      valid.reason,
      'lifecycle_ready',
    );
    assert.equal(
      valid.validityEvaluatedAgainstClock,
      true,
    );
    assert.equal(
      valid.credentialCurrentlyValid,
      true,
    );
    assert.deepEqual(
      valid.lifecycleContract,
      pureContract,
    );
    assert.equal(
      valid.revocationChecked,
      false,
    );
    assert.equal(
      valid.currentAuthorizationEstablished,
      false,
    );
    assert.equal(
      valid.productionActivation,
      false,
    );

    record(
      'pure current-time valid',
      valid.reason,
    );

    const future =
      evaluatePhase5AgentDelegationLifecycle({
        delegationDocument:
          delegationDocument(
            pureContract,
            {
              notBeforeSec:
                NOW_SEC + 30,
            },
          ),

        proofVerification:
          acceptedProof(pureContract),

        cryptographicBinding:
          acceptedBinding(pureContract),

        nowSec: NOW_SEC,
      });

    assert.equal(future.ok, false);
    assert.equal(
      future.reason,
      'delegation_not_yet_valid',
    );
    assert.equal(
      future.validityEvaluatedAgainstClock,
      true,
    );

    record(
      'pure not-yet-valid rejection',
      future.reason,
    );

    const expired =
      evaluatePhase5AgentDelegationLifecycle({
        delegationDocument:
          delegationDocument(
            pureContract,
            {
              expiresAtSec:
                NOW_SEC,
            },
          ),

        proofVerification:
          acceptedProof(pureContract),

        cryptographicBinding:
          acceptedBinding(pureContract),

        nowSec: NOW_SEC,
      });

    assert.equal(expired.ok, false);
    assert.equal(
      expired.reason,
      'delegation_expired',
    );
    assert.equal(
      expired.validityEvaluatedAgainstClock,
      true,
    );

    record(
      'pure expiry rejection',
      expired.reason,
    );

    const mismatchBinding = {
      ...acceptedBinding(pureContract),
      credentialHash:
        sha256Hex(
          `${PREFIX}:binding-mismatch`,
        ),
    } as unknown as
      Phase5AgentCryptographicBindingResult;

    const mismatch =
      evaluatePhase5AgentDelegationLifecycle({
        delegationDocument:
          delegationDocument(pureContract),

        proofVerification:
          acceptedProof(pureContract),

        cryptographicBinding:
          mismatchBinding,

        nowSec: NOW_SEC,
      });

    assert.equal(mismatch.ok, false);
    assert.equal(
      mismatch.reason,
      'lifecycle_contract_mismatch',
    );

    record(
      'pure lifecycle contract mismatch',
      mismatch.reason,
    );

    const rejectedProof = {
      ...acceptedProof(pureContract),
      ok: false,
      agentProofOfPossessionVerified:
        false,
    } as unknown as
      AgentProofOfPossessionVerificationResult;

    const cryptoRejected =
      evaluatePhase5AgentDelegationLifecycle({
        delegationDocument:
          delegationDocument(pureContract),

        proofVerification:
          rejectedProof,

        cryptographicBinding:
          acceptedBinding(pureContract),

        nowSec: NOW_SEC,
      });

    assert.equal(
      cryptoRejected.ok,
      false,
    );
    assert.equal(
      cryptoRejected.reason,
      'cryptographic_delegation_not_verified',
    );
    assert.equal(
      cryptoRejected
        .validityEvaluatedAgainstClock,
      false,
    );

    record(
      'pure cryptographic prerequisite',
      cryptoRejected.reason,
    );

    const notRevokedContract =
      lifecycleContract('not-revoked');

    const notRevoked =
      await checkPhase5AgentDelegationRevocation(
        notRevokedContract,
      );

    assert.equal(notRevoked.ok, true);
    assert.equal(
      notRevoked.reason,
      'not_revoked',
    );
    assert.equal(
      notRevoked.revocationChecked,
      true,
    );
    assert.equal(
      notRevoked.delegationRevoked,
      false,
    );

    record(
      'durable revocation absence',
      notRevoked.reason,
    );

    const revokedContract =
      lifecycleContract('revoked');

    await insertRevocation(
      client,
      revokedContract,
    );

    const revoked =
      await checkPhase5AgentDelegationRevocation(
        revokedContract,
      );

    assert.equal(revoked.ok, false);
    assert.equal(
      revoked.reason,
      'delegation_revoked',
    );
    assert.equal(
      revoked.delegationRevoked,
      true,
    );
    assert.equal(
      revoked.lifecycleContractMatched,
      true,
    );

    record(
      'durable revocation rejection',
      revoked.reason,
    );

    const mismatchContract =
      lifecycleContract('revocation-mismatch');

    await insertRevocation(
      client,
      mismatchContract,
      {
        delegationId:
          `${PREFIX}-wrong-delegation`,

        credentialHash:
          sha256Hex(
            `${PREFIX}:wrong-credential`,
          ),
      },
    );

    const revocationMismatch =
      await checkPhase5AgentDelegationRevocation(
        mismatchContract,
      );

    assert.equal(
      revocationMismatch.ok,
      false,
    );
    assert.equal(
      revocationMismatch.reason,
      'revocation_record_mismatch',
    );
    assert.equal(
      revocationMismatch
        .lifecycleContractMatched,
      false,
    );

    record(
      'durable revocation contract mismatch',
      revocationMismatch.reason,
    );

    const claimContract =
      lifecycleContract('claim');

    const claimNonce =
      `${PREFIX}-nonce-claim`;

    await insertChallenge(
      client,
      claimNonce,
    );

    const firstClaim =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...claimContract,

        nonce: claimNonce,
        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 isolated first use.',
      });

    assert.equal(firstClaim.ok, true);
    assert.equal(
      firstClaim.reason,
      'claimed',
    );
    assert.equal(
      firstClaim.boundedUseConsumed,
      true,
    );
    assert.equal(
      firstClaim.usageClaimCreated,
      true,
    );
    assert.equal(
      firstClaim.policyStateMutated,
      true,
    );
    assert.equal(
      firstClaim.usageCount,
      1,
    );
    assert.equal(
      await challengeState(
        client,
        claimNonce,
      ),
      'POLICY_SATISFIED',
    );
    assert.equal(
      await transitionCount(
        client,
        claimNonce,
      ),
      1,
    );

    record(
      'atomic first bounded use',
      firstClaim.reason,
    );

    const idempotentClaim =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...claimContract,

        nonce: claimNonce,
        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 isolated idempotent retry.',
      });

    assert.equal(
      idempotentClaim.ok,
      true,
    );
    assert.equal(
      idempotentClaim.reason,
      'already_claimed',
    );
    assert.equal(
      idempotentClaim
        .usageClaimIdempotent,
      true,
    );
    assert.equal(
      idempotentClaim
        .usageClaimCreated,
      false,
    );
    assert.equal(
      idempotentClaim.usageCount,
      1,
    );
    assert.equal(
      await transitionCount(
        client,
        claimNonce,
      ),
      1,
    );

    record(
      'same-challenge idempotency',
      idempotentClaim.reason,
    );

    const exhaustedNonce =
      `${PREFIX}-nonce-exhausted`;

    await insertChallenge(
      client,
      exhaustedNonce,
    );

    const exhausted =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...claimContract,

        nonce:
          exhaustedNonce,

        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 isolated exhaustion test.',
      });

    assert.equal(exhausted.ok, false);
    assert.equal(
      exhausted.reason,
      'delegation_use_exhausted',
    );
    assert.equal(
      exhausted.boundedUseConsumed,
      false,
    );
    assert.equal(
      exhausted.usageCount,
      1,
    );
    assert.equal(
      await challengeState(
        client,
        exhaustedNonce,
      ),
      'ISSUED',
    );

    record(
      'new-challenge exhaustion',
      exhausted.reason,
    );

    const snapshot =
      await getPhase5AgentDelegationUsageSnapshot(
        claimContract.credentialHash,
      );

    assert.equal(snapshot.found, true);

    if (snapshot.found) {
      assert.equal(
        snapshot.consumedUses,
        1,
      );
      assert.equal(
        snapshot.claimCount,
        1,
      );
      assert.equal(
        snapshot.maxUses,
        1,
      );
    }

    record(
      'durable usage snapshot',
      'consumed=1 max=1 claims=1',
    );

    const revokedClaimContract =
      lifecycleContract('revoked-claim');

    const revokedClaimNonce =
      `${PREFIX}-nonce-revoked`;

    await insertChallenge(
      client,
      revokedClaimNonce,
    );

    await insertRevocation(
      client,
      revokedClaimContract,
    );

    const revokedClaim =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...revokedClaimContract,

        nonce:
          revokedClaimNonce,

        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 revoked claim test.',
      });

    assert.equal(
      revokedClaim.ok,
      false,
    );
    assert.equal(
      revokedClaim.reason,
      'delegation_revoked',
    );
    assert.equal(
      revokedClaim.boundedUseConsumed,
      false,
    );
    assert.equal(
      await challengeState(
        client,
        revokedClaimNonce,
      ),
      'ISSUED',
    );

    const revokedSnapshot =
      await getPhase5AgentDelegationUsageSnapshot(
        revokedClaimContract
          .credentialHash,
      );

    assert.deepEqual(
      revokedSnapshot,
      {
        found: false,
      },
    );

    record(
      'revocation recheck at claim',
      revokedClaim.reason,
    );

    const usageMismatchContract =
      lifecycleContract('usage-mismatch');

    const usageMismatchNonce =
      `${PREFIX}-nonce-usage-mismatch`;

    await insertChallenge(
      client,
      usageMismatchNonce,
    );

    await seedUsageMismatch(
      client,
      usageMismatchContract,
    );

    const usageMismatch =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...usageMismatchContract,

        nonce:
          usageMismatchNonce,

        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 usage mismatch test.',
      });

    assert.equal(
      usageMismatch.ok,
      false,
    );
    assert.equal(
      usageMismatch.reason,
      'usage_contract_mismatch',
    );
    assert.equal(
      usageMismatch
        .lifecycleContractMatched,
      false,
    );
    assert.equal(
      await challengeState(
        client,
        usageMismatchNonce,
      ),
      'ISSUED',
    );

    record(
      'durable usage contract mismatch',
      usageMismatch.reason,
    );

    const concurrentContract =
      lifecycleContract('concurrent');

    const concurrentNonceA =
      `${PREFIX}-nonce-concurrent-a`;

    const concurrentNonceB =
      `${PREFIX}-nonce-concurrent-b`;

    await insertChallenge(
      client,
      concurrentNonceA,
    );

    await insertChallenge(
      client,
      concurrentNonceB,
    );

    const concurrentResults =
      await Promise.all([
        claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
          ...concurrentContract,

          nonce:
            concurrentNonceA,

          actor: 'gateway',
          reasonCode:
            'phase5_lifecycle_satisfied',
          reasonMessage:
            'PR #297 concurrent claim A.',
        }),

        claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
          ...concurrentContract,

          nonce:
            concurrentNonceB,

          actor: 'gateway',
          reasonCode:
            'phase5_lifecycle_satisfied',
          reasonMessage:
            'PR #297 concurrent claim B.',
        }),
      ]);

    const concurrentAccepted =
      concurrentResults.filter(
        (result) =>
          result.ok &&
          result.reason === 'claimed',
      );

    const concurrentExhausted =
      concurrentResults.filter(
        (result) =>
          !result.ok &&
          result.reason ===
            'delegation_use_exhausted',
      );

    assert.equal(
      concurrentAccepted.length,
      1,
    );

    assert.equal(
      concurrentExhausted.length,
      1,
    );

    const concurrentStates =
      await Promise.all([
        challengeState(
          client,
          concurrentNonceA,
        ),

        challengeState(
          client,
          concurrentNonceB,
        ),
      ]);

    assert.equal(
      concurrentStates.filter(
        (state) =>
          state ===
          'POLICY_SATISFIED',
      ).length,
      1,
    );

    assert.equal(
      concurrentStates.filter(
        (state) =>
          state === 'ISSUED',
      ).length,
      1,
    );

    const concurrentSnapshot =
      await getPhase5AgentDelegationUsageSnapshot(
        concurrentContract
          .credentialHash,
      );

    assert.equal(
      concurrentSnapshot.found,
      true,
    );

    if (concurrentSnapshot.found) {
      assert.equal(
        concurrentSnapshot
          .consumedUses,
        1,
      );

      assert.equal(
        concurrentSnapshot
          .claimCount,
        1,
      );
    }

    record(
      'concurrent maxUses=1 enforcement',
      'one claimed and one exhausted',
    );

    const missingContract =
      lifecycleContract('missing');

    const missing =
      await claimPhase5AgentDelegationUseAndPersistPolicySatisfied({
        ...missingContract,

        nonce:
          `${PREFIX}-nonce-missing`,

        actor: 'gateway',
        reasonCode:
          'phase5_lifecycle_satisfied',
        reasonMessage:
          'PR #297 missing challenge test.',
      });

    assert.equal(missing.ok, false);
    assert.equal(
      missing.reason,
      'challenge_missing',
    );
    assert.equal(
      missing.boundedUseConsumed,
      false,
    );

    record(
      'missing canonical challenge',
      missing.reason,
    );

    console.log();
    console.log(
      JSON.stringify(
        {
          label: LABEL,
          runId: RUN_ID,
          totalCases:
            results.length,
          passedCases:
            results.filter(
              (result) =>
                result.passed,
            ).length,
          failedCases:
            results.filter(
              (result) =>
                !result.passed,
            ).length,
          paymentAttempted: false,
          crpCalled: false,
          protectedResourceReleased: false,
          agentRegistryLookupAttempted: false,
          productionActivation: false,
          cases: results,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(client);

    const residue =
      await residueCounts(client);

    console.log();
    console.log(
      "PR297_LIFECYCLE_HARNESS_RESIDUAL_CHALLENGES=" +
      residue.challenges,
    );

    console.log(
      "PR297_LIFECYCLE_HARNESS_RESIDUAL_REVOCATIONS=" +
      residue.revocations,
    );

    console.log(
      "PR297_LIFECYCLE_HARNESS_RESIDUAL_USAGE=" +
      residue.usage,
    );

    console.log(
      "PR297_LIFECYCLE_HARNESS_RESIDUAL_CLAIMS=" +
      residue.claims,
    );

    assert.deepEqual(
      residue,
      {
        challenges: 0,
        revocations: 0,
        usage: 0,
        claims: 0,
      },
    );

    await client.end();
    await pool.end();
  }
}

main()
  .then(() => {
    console.log();
    console.log(
      'PR297_LIFECYCLE_HARNESS_COMPLETE=true',
    );
  })
  .catch(async (error) => {
    console.error(error);

    try {
      await pool.end();
    } catch {
      // Preserve the original failure.
    }

    console.log(
      'PR297_LIFECYCLE_HARNESS_COMPLETE=false',
    );

    process.exitCode = 1;
  });
