export type GatedPolicyEvidence = {
  nonce?: string;
  policyKind?: string;
  region?: string;
  claims?: {
    ageOver?: number;
    ageAtLeast?: number;
    [k: string]: unknown;
  };
  subjectRef?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  externalValidationRef?: string | null;
  signature?: string | null;
};

export type AuthorizationProofEnvelope = {
  type?: string;
  nonce?: string;
  policyKind?: string;
  subjectAccountId?: string;
  subjectRef?: string;
  issuer?: string;
  claims?: {
    region?: string;
    ageOver?: number;
    ageAtLeast?: number;
    [k: string]: unknown;
  };
  issuedAt?: string;
  expiresAt?: string;
  externalValidationRef?: string | null;
  signature?: string | null;
};

export type PolicyVerifierInput = {
  nonce: string;
  authorizationProof?: AuthorizationProofEnvelope | null;
  policyEvidence?: GatedPolicyEvidence | null;
};

export type PolicyVerifierResult =
  | {
      ok: true;
      verifierType: 'demo_policy_verifier_v1';
      policyEvidence: GatedPolicyEvidence;
      subjectRef?: string;
      evidenceDigest?: string;
    }
  | {
      ok: false;
      verifierType: 'demo_policy_verifier_v1';
      code: string;
      reason: string;
      message: string;
    };

export function normalizeAuthorizationProofToPolicyEvidence(
  authorizationProof: AuthorizationProofEnvelope | null | undefined,
): GatedPolicyEvidence | null {
  if (!authorizationProof || typeof authorizationProof !== 'object') return null;

  return {
    nonce: authorizationProof.nonce,
    policyKind: authorizationProof.policyKind ?? 'composite',
    region:
      typeof authorizationProof.claims?.region === 'string'
        ? authorizationProof.claims.region
        : undefined,
    claims: authorizationProof.claims,
    subjectRef: authorizationProof.subjectRef ?? authorizationProof.subjectAccountId,
    issuer: authorizationProof.issuer,
    issuedAt: authorizationProof.issuedAt,
    expiresAt: authorizationProof.expiresAt,
    externalValidationRef: authorizationProof.externalValidationRef,
    signature: authorizationProof.signature,
  };
}

export function verifyDemoPolicyAuthorization(input: PolicyVerifierInput): PolicyVerifierResult {
  const policyEvidence =
    input.policyEvidence ??
    normalizeAuthorizationProofToPolicyEvidence(input.authorizationProof);

  if (!policyEvidence) {
    return {
      ok: false,
      verifierType: 'demo_policy_verifier_v1',
      code: 'missing_authorization_proof',
      reason: 'missing_authorization_proof',
      message: 'Authorization proof or policy evidence is required for this resource.',
    };
  }

  return {
    ok: true,
    verifierType: 'demo_policy_verifier_v1',
    policyEvidence,
    subjectRef: policyEvidence.subjectRef,
  };
}
