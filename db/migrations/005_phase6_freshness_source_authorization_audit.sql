-- PR #304: persist the normalized freshness source and align the
-- allowed Phase 6 audit profile with source-aware indexer-lag semantics.
--
-- Direct-chain finalized evidence has no indexer and therefore records
-- indexer_lag_blocks as NULL. Fixture and auditable-resolver evidence retain
-- an explicit zero-lag requirement for allowed authorization rows.
--
-- Migrations 003 and 004 remain immutable. Existing append-only rows are
-- preserved; their freshness_source remains NULL.

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  ADD COLUMN IF NOT EXISTS
    freshness_source text;

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  DROP CONSTRAINT IF EXISTS
    phase6_agent_registry_authorization_freshness_source_check;

ALTER TABLE
  public.phase6_agent_registry_authorization_audit
  ADD CONSTRAINT
    phase6_agent_registry_authorization_freshness_source_check
  CHECK (
    freshness_source IS NULL OR
    freshness_source IN (
      'fixture',
      'direct_chain',
      'auditable_resolver'
    )
  );

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
      (
        (
          freshness_source = 'direct_chain' AND
          indexer_lag_blocks IS NULL
        ) OR
        (
          freshness_source IN (
            'fixture',
            'auditable_resolver'
          ) AND
          indexer_lag_blocks = 0
        )
      ) AND
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

COMMENT ON COLUMN
  public.phase6_agent_registry_authorization_audit.freshness_source
IS
  'Sanitized Agent Registry freshness source: fixture, direct_chain, or auditable_resolver.';

COMMENT ON CONSTRAINT
  phase6_agent_registry_authorization_allowed_evidence_check
ON public.phase6_agent_registry_authorization_audit
IS
  'Allowed rows require direct-chain evidence with non-applicable NULL indexer lag, or fixture/auditable-resolver evidence with explicit zero lag, plus the complete owner-account, key, card, capability, and finalized-freshness profile.';
