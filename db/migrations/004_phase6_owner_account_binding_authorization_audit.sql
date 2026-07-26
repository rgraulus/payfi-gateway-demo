-- PR #304: align the allowed Phase 6 audit profile with the
-- production-shaped CIS-8004 evidence contract.
--
-- A bound on-chain owner account is not separate verified owner identity.
-- Migration 003 remains immutable and existing append-only rows are preserved.

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  DROP CONSTRAINT IF EXISTS
    phase6_agent_registry_authorization_audit_check;

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  DROP CONSTRAINT IF EXISTS
    phase6_agent_registry_authorization_allowed_evidence_check;

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  ADD CONSTRAINT
    phase6_agent_registry_authorization_allowed_evidence_check
  CHECK (
    decision <> 'allowed' OR (
      registry_network IS NOT NULL AND
      registry_contract_index IS NOT NULL AND
      registry_contract_subindex IS NOT NULL AND
      agent_token_id IS NOT NULL AND
      token_address IS NOT NULL AND
      registry_status = 'Active' AND
      owner_account IS NOT NULL AND
      owner_account_bound = true AND
      owner_identity_assurance = 'not_evaluated' AND
      finalized_block_height IS NOT NULL AND
      finalized_block_hash IS NOT NULL AND
      evidence_observed_at IS NOT NULL AND
      evidence_age_seconds IS NOT NULL AND
      indexer_lag_blocks = 0 AND
      agent_card_expected_hash IS NOT NULL AND
      agent_card_actual_hash IS NOT NULL AND
      agent_card_expected_hash = agent_card_actual_hash AND
      agent_card_byte_length IS NOT NULL AND
      agent_card_byte_length > 0 AND
      agent_card_integrity_verified = true AND
      jsonb_array_length(required_capabilities) > 0 AND
      jsonb_array_length(missing_capabilities) = 0 AND
      capability_policy_satisfied = true AND
      key_binding_required = true AND
      key_binding_verified = true AND
      key_binding_type IS NOT NULL AND
      key_fingerprint IS NOT NULL AND
      registry_read_captured = true
    )
  );

COMMENT ON CONSTRAINT
  phase6_agent_registry_authorization_allowed_evidence_check
ON public.phase6_agent_registry_authorization_audit
IS
  'Allowed rows require bound owner-account evidence with truthful not_evaluated owner-identity assurance plus verified key, card, capability, and finalized-freshness evidence.';
