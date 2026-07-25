-- PR #303: append-only sanitized Agent Registry authorization audit.
--
-- This table records only normalized authorization evidence and execution
-- indicators. It deliberately has no columns for raw Agent Card bytes,
-- parsed Agent Card documents, delegation documents, proof material,
-- credentials, signing keys, receipts, or payment responses.
--
-- Multiple decisions may be recorded for one challenge or nonce so that
-- denied and revalidation-required attempts remain observable without
-- overwriting prior evidence.

CREATE TABLE IF NOT EXISTS public.phase6_agent_registry_authorization_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  schema_version smallint NOT NULL DEFAULT 1
    CHECK (schema_version = 1),

  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),

  challenge_id text NOT NULL
    CHECK (
      length(btrim(challenge_id)) BETWEEN 1 AND 512
    ),

  nonce text NOT NULL
    CHECK (
      length(btrim(nonce)) BETWEEN 1 AND 512
    ),

  merchant_id text NOT NULL
    CHECK (
      length(btrim(merchant_id)) BETWEEN 1 AND 512
    ),

  decision text NOT NULL
    CHECK (
      decision IN (
        'allowed',
        'denied',
        'revalidation_required'
      )
    ),

  reason text NOT NULL
    CHECK (
      length(btrim(reason)) BETWEEN 1 AND 512
    ),

  registry_network text,
  registry_contract_index text,
  registry_contract_subindex bigint,
  registry_module_reference text,
  agent_token_id text,
  token_address text,

  registry_status text,
  owner_account text,
  owner_account_bound boolean NOT NULL DEFAULT false,
  owner_identity_assurance text,

  finalized_block_height bigint,
  finalized_block_hash text,
  evidence_observed_at timestamptz,
  evidence_age_seconds integer,
  indexer_lag_blocks integer,

  agent_card_expected_hash text,
  agent_card_actual_hash text,
  agent_card_byte_length integer,
  agent_card_integrity_verified boolean NOT NULL DEFAULT false,

  required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  satisfied_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_policy_satisfied boolean NOT NULL DEFAULT false,

  key_binding_required boolean NOT NULL DEFAULT false,
  key_binding_verified boolean NOT NULL DEFAULT false,
  key_binding_type text,
  key_fingerprint text,

  registry_evidence_hash text,
  authorization_evidence_hash text NOT NULL
    CHECK (
      length(btrim(authorization_evidence_hash)) BETWEEN 1 AND 512
    ),

  registry_read_captured boolean NOT NULL DEFAULT false,
  agent_registry_lookup_attempted boolean NOT NULL DEFAULT false,
  registry_network_called boolean NOT NULL DEFAULT false,
  cis8_lookup_attempted boolean NOT NULL DEFAULT false,
  agent_card_fetch_attempted boolean NOT NULL DEFAULT false,
  agent_card_network_called boolean NOT NULL DEFAULT false,

  buyer_policy_evaluated boolean NOT NULL DEFAULT false
    CHECK (buyer_policy_evaluated = false),

  canonical_state_mutated boolean NOT NULL DEFAULT false
    CHECK (canonical_state_mutated = false),

  bounded_use_consumed boolean NOT NULL DEFAULT false
    CHECK (bounded_use_consumed = false),

  replay_state_mutated boolean NOT NULL DEFAULT false
    CHECK (replay_state_mutated = false),

  payment_attempted boolean NOT NULL DEFAULT false
    CHECK (payment_attempted = false),

  receipt_issued boolean NOT NULL DEFAULT false
    CHECK (receipt_issued = false),

  resource_released boolean NOT NULL DEFAULT false
    CHECK (resource_released = false),

  production_activation boolean NOT NULL DEFAULT false
    CHECK (production_activation = false),

  CHECK (
    registry_contract_subindex IS NULL OR
    registry_contract_subindex >= 0
  ),

  CHECK (
    finalized_block_height IS NULL OR
    finalized_block_height >= 0
  ),

  CHECK (
    evidence_age_seconds IS NULL OR
    evidence_age_seconds >= 0
  ),

  CHECK (
    indexer_lag_blocks IS NULL OR
    indexer_lag_blocks >= 0
  ),

  CHECK (
    agent_card_byte_length IS NULL OR
    agent_card_byte_length >= 0
  ),

  CHECK (
    jsonb_typeof(required_capabilities) = 'array'
  ),

  CHECK (
    jsonb_typeof(satisfied_capabilities) = 'array'
  ),

  CHECK (
    jsonb_typeof(missing_capabilities) = 'array'
  ),

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
      owner_identity_assurance = 'verified' AND
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
  )
);

CREATE INDEX IF NOT EXISTS
  phase6_agent_registry_authorization_audit_challenge_idx
ON public.phase6_agent_registry_authorization_audit (
  challenge_id,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  phase6_agent_registry_authorization_audit_nonce_idx
ON public.phase6_agent_registry_authorization_audit (
  nonce,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  phase6_agent_registry_authorization_audit_merchant_nonce_idx
ON public.phase6_agent_registry_authorization_audit (
  merchant_id,
  nonce,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  phase6_agent_registry_authorization_audit_registry_identity_idx
ON public.phase6_agent_registry_authorization_audit (
  registry_network,
  registry_contract_index,
  registry_contract_subindex,
  agent_token_id,
  recorded_at DESC
)
WHERE
  registry_network IS NOT NULL AND
  registry_contract_index IS NOT NULL AND
  agent_token_id IS NOT NULL;

CREATE OR REPLACE FUNCTION
  public.reject_phase6_agent_registry_authorization_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'phase6_agent_registry_authorization_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS
  phase6_agent_registry_authorization_audit_reject_update_delete
ON public.phase6_agent_registry_authorization_audit;

CREATE TRIGGER
  phase6_agent_registry_authorization_audit_reject_update_delete
BEFORE UPDATE OR DELETE
ON public.phase6_agent_registry_authorization_audit
FOR EACH ROW
EXECUTE FUNCTION
  public.reject_phase6_agent_registry_authorization_audit_mutation();

DROP TRIGGER IF EXISTS
  phase6_agent_registry_authorization_audit_reject_truncate
ON public.phase6_agent_registry_authorization_audit;

CREATE TRIGGER
  phase6_agent_registry_authorization_audit_reject_truncate
BEFORE TRUNCATE
ON public.phase6_agent_registry_authorization_audit
FOR EACH STATEMENT
EXECUTE FUNCTION
  public.reject_phase6_agent_registry_authorization_audit_mutation();

COMMENT ON TABLE
  public.phase6_agent_registry_authorization_audit
IS
  'Append-only sanitized Phase 6 Agent Registry authorization decisions recorded before buyer policy, bounded-use claim, payment, receipt, or release.';
