/**
 * Phase 3 policy verifier seam.
 *
 * This module converts a Concordium ZKP verifier result plus expected policy
 * requirements into a safe allow/deny decision object.
 *
 * Scope boundary:
 * - Does not release resources.
 * - Does not mutate Gateway state.
 * - Does not call CRP, payment, replay, or live WebSDK paths.
 * - Intended for later Gateway integration behind an explicit enforcement PR.
 */

import type { ConcordiumZkpVerifierResult } from './concordiumZkpVerifier';
import type { X402ZkpChallenge } from './zkpChallenge';

export type Phase3PolicyRequirement = {
  policyId: string;
  policyVersion: string;
  requirementsHash: string;
  requireVerifiedProof?: boolean;
  allowParsedOnly?: boolean;
};

export type Phase3PolicyVerifierInput = {
  challenge: X402ZkpChallenge;
  verifierResult: ConcordiumZkpVerifierResult;
  requirement: Phase3PolicyRequirement;
  now?: number;
};

export type Phase3PolicyDecisionCode =
  | 'policy_satisfied'
  | 'verifier_failed'
  | 'policy_mismatch'
  | 'challenge_expired'
  | 'verified_proof_required'
  | 'wallet_challenge_required'
  | 'wallet_challenge_mismatch'
  | 'delegated_agent_not_supported'
  | 'agent_registry_not_checked'
  | 'raw_proof_printed_violation';

export type Phase3PolicyDecision = {
  ok: boolean;
  allowed: boolean;
  code: Phase3PolicyDecisionCode;
  policyId: string;
  policyVersion: string;
  requirementsHash: string;
  verifierStage?: string;
  challengeBinding?: string | null;
  rawProofPrinted: false;
  reason: string | null;
};

function fail(
  input: Phase3PolicyVerifierInput,
  code: Exclude<Phase3PolicyDecisionCode, 'policy_satisfied'>,
  reason: string,
): Phase3PolicyDecision {
  return {
    ok: false,
    allowed: false,
    code,
    policyId: input.requirement.policyId,
    policyVersion: input.requirement.policyVersion,
    requirementsHash: input.requirement.requirementsHash,
    verifierStage: input.verifierResult.stage,
    challengeBinding: input.verifierResult.challengeBinding ?? null,
    rawProofPrinted: false,
    reason,
  };
}

export function verifyPhase3Policy(input: Phase3PolicyVerifierInput): Phase3PolicyDecision {
  const { challenge, verifierResult, requirement } = input;

  if (verifierResult.rawProofPrinted !== false) {
    return fail(input, 'raw_proof_printed_violation', 'verifier result violated raw proof safety invariant');
  }

  if (challenge.policy.policyId !== requirement.policyId) {
    return fail(input, 'policy_mismatch', 'challenge policyId does not match expected policy requirement');
  }

  if (challenge.policy.policyVersion !== requirement.policyVersion) {
    return fail(input, 'policy_mismatch', 'challenge policyVersion does not match expected policy requirement');
  }

  if (challenge.policy.requirementsHash !== requirement.requirementsHash) {
    return fail(input, 'policy_mismatch', 'challenge requirementsHash does not match expected policy requirement');
  }

  if (input.now !== undefined && input.now > challenge.expiresAt) {
    return fail(input, 'challenge_expired', 'challenge expired before policy evaluation');
  }

  if (!verifierResult.ok) {
    if (verifierResult.stage === 'delegated_not_supported') {
      return fail(input, 'delegated_agent_not_supported', verifierResult.reason ?? 'delegated-agent verification is not supported');
    }

    return fail(input, 'verifier_failed', verifierResult.reason ?? 'verifier result is not ok');
  }

  if (verifierResult.agentRegistryLookupAttempted !== false) {
    return fail(input, 'agent_registry_not_checked', 'agent registry lookup must remain disabled in direct Buyer seam');
  }

  if (verifierResult.delegatedAgentVerificationSupported !== false) {
    return fail(input, 'delegated_agent_not_supported', 'delegated-agent verification must remain disabled in direct Buyer seam');
  }

  if (requirement.requireVerifiedProof && verifierResult.stage !== 'verified') {
    return fail(input, 'verified_proof_required', 'policy requires live verified proof');
  }

  if (!requirement.allowParsedOnly && verifierResult.stage === 'parsed' && !requirement.requireVerifiedProof) {
    return fail(input, 'verified_proof_required', 'parsed-only verifier result is not allowed by policy requirement');
  }

  if (verifierResult.stage === 'verified') {
    if (!verifierResult.walletChallenge) {
      return fail(input, 'wallet_challenge_required', 'verified proof must include walletChallenge');
    }

    if (verifierResult.challengeBinding !== 'walletChallenge') {
      return fail(input, 'wallet_challenge_required', 'verified proof must bind against walletChallenge');
    }

    if (verifierResult.verifiedChallenge !== verifierResult.walletChallenge) {
      return fail(input, 'wallet_challenge_mismatch', 'verified challenge does not match walletChallenge');
    }
  }

  return {
    ok: true,
    allowed: true,
    code: 'policy_satisfied',
    policyId: requirement.policyId,
    policyVersion: requirement.policyVersion,
    requirementsHash: requirement.requirementsHash,
    verifierStage: verifierResult.stage,
    challengeBinding: verifierResult.challengeBinding ?? null,
    rawProofPrinted: false,
    reason: null,
  };
}
