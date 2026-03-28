CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS payment_challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  merchant_id TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  resource_hash TEXT NOT NULL,

  contract_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  contract_snapshot JSONB NOT NULL,
  payment_request_hash TEXT NOT NULL,

  status TEXT NOT NULL,
  release_status TEXT NOT NULL DEFAULT 'NOT_RELEASED',

  payment_mode TEXT NOT NULL,
  network TEXT NOT NULL,
  asset JSONB NOT NULL,
  amount TEXT NOT NULL,
  pay_to TEXT NOT NULL,

  idempotency_key TEXT NOT NULL UNIQUE,

  source_proof_id TEXT NULL,
  source_tx_hash TEXT NULL,

  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_challenges_source_proof_id
  ON payment_challenges (source_proof_id)
  WHERE source_proof_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_challenges_source_tx_hash
  ON payment_challenges (source_tx_hash)
  WHERE source_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_payment_challenges_status
  ON payment_challenges (status);

CREATE INDEX IF NOT EXISTS ix_payment_challenges_release_status
  ON payment_challenges (release_status);

CREATE INDEX IF NOT EXISTS ix_payment_challenges_expires_at
  ON payment_challenges (expires_at);

CREATE TABLE IF NOT EXISTS gateway_state_transitions (
  transition_id BIGSERIAL PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES payment_challenges(challenge_id) ON DELETE CASCADE,
  from_state TEXT NULL,
  to_state TEXT NOT NULL,
  actor TEXT NULL,
  reason_code TEXT NULL,
  reason_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_gateway_state_transitions_challenge_id
  ON gateway_state_transitions (challenge_id, created_at ASC);

CREATE TABLE IF NOT EXISTS gateway_release_events (
  release_event_id BIGSERIAL PRIMARY KEY,
  challenge_id UUID NOT NULL UNIQUE REFERENCES payment_challenges(challenge_id) ON DELETE CASCADE,
  receipt_jws TEXT NULL,
  response_headers JSONB NULL,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
