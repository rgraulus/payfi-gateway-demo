CREATE TABLE IF NOT EXISTS phase5_agent_delegation_revocations (
  revocation_id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL,
  credential_hash TEXT NOT NULL,

  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code TEXT NOT NULL,
  reason_message TEXT NULL,
  metadata JSONB NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_phase5_agent_delegation_revocations_credential_hash
    CHECK (credential_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS ix_phase5_agent_delegation_revocations_delegation
  ON phase5_agent_delegation_revocations (
    delegation_id,
    credential_hash
  );

CREATE TABLE IF NOT EXISTS phase5_agent_delegation_usage (
  credential_hash TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL,
  revocation_id TEXT NOT NULL,

  buyer_key_version BIGINT NOT NULL,
  agent_key_version BIGINT NOT NULL,

  max_uses INTEGER NOT NULL,
  consumed_uses INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_phase5_agent_delegation_usage_credential_hash
    CHECK (credential_hash ~ '^[0-9a-f]{64}$'),

  CONSTRAINT ck_phase5_agent_delegation_usage_buyer_key_version
    CHECK (buyer_key_version > 0),

  CONSTRAINT ck_phase5_agent_delegation_usage_agent_key_version
    CHECK (agent_key_version > 0),

  CONSTRAINT ck_phase5_agent_delegation_usage_max_uses
    CHECK (max_uses > 0),

  CONSTRAINT ck_phase5_agent_delegation_usage_consumed_uses
    CHECK (
      consumed_uses >= 0
      AND consumed_uses <= max_uses
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_phase5_agent_delegation_usage_identity
  ON phase5_agent_delegation_usage (
    delegation_id,
    credential_hash
  );

CREATE INDEX IF NOT EXISTS ix_phase5_agent_delegation_usage_revocation_id
  ON phase5_agent_delegation_usage (
    revocation_id
  );

CREATE TABLE IF NOT EXISTS phase5_agent_delegation_use_claims (
  claim_id BIGSERIAL PRIMARY KEY,

  credential_hash TEXT NOT NULL
    REFERENCES phase5_agent_delegation_usage (
      credential_hash
    )
    ON DELETE CASCADE,

  challenge_id UUID NOT NULL
    REFERENCES payment_challenges (
      challenge_id
    )
    ON DELETE CASCADE,

  challenge_nonce TEXT NOT NULL,
  use_number INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_phase5_agent_delegation_use_claims_use_number
    CHECK (use_number > 0),

  CONSTRAINT ux_phase5_agent_delegation_use_claims_nonce
    UNIQUE (challenge_nonce),

  CONSTRAINT ux_phase5_agent_delegation_use_claims_challenge
    UNIQUE (challenge_id),

  CONSTRAINT ux_phase5_agent_delegation_use_claims_sequence
    UNIQUE (
      credential_hash,
      use_number
    )
);

CREATE INDEX IF NOT EXISTS ix_phase5_agent_delegation_use_claims_credential
  ON phase5_agent_delegation_use_claims (
    credential_hash,
    created_at
  );
