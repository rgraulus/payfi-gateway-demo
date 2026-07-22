#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS on Windows can rewrite paths unexpectedly.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

ROOT_DIR="$(
  cd "$(
    dirname "${BASH_SOURCE[0]}"
  )/.." &&
  pwd
)"

cd "$ROOT_DIR"

DB_CONTAINER="${DB_CONTAINER:-xcf-pg}"
DB_NAME="${DB_NAME:-transaction-outcome}"
DB_USER="${DB_USER:-postgres}"

DATABASE_URL="${DATABASE_URL:-postgres://postgres:pg@127.0.0.1:5432/transaction-outcome}"

MIGRATION_FILE="$ROOT_DIR/db/migrations/002_phase5_agent_delegation_lifecycle.sql"

say() {
  echo
  echo ">>> $*"
}

fail() {
  echo
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 ||
    fail "Missing required command: $1"
}

require_cmd docker
require_cmd npm

[[ -f "$MIGRATION_FILE" ]] ||
  fail "Migration file not found: $MIGRATION_FILE"

CONTAINER_RUNNING="$(
  docker inspect \
    --format '{{.State.Running}}' \
    "$DB_CONTAINER" \
    2>/dev/null ||
  true
)"

[[ "$CONTAINER_RUNNING" == "true" ]] ||
  fail "Database container is not running: $DB_CONTAINER"

echo
echo "============================================================"
echo " Phase 5 Agent Delegation Lifecycle — Final Acceptance"
echo "============================================================"
echo
echo "Database container: $DB_CONTAINER"
echo "Database name:      $DB_NAME"
echo "Database user:      $DB_USER"
echo
echo "Safety boundary:"
echo "  Production activation: false"
echo "  Agent Registry lookup: false"
echo "  Payment attempted: false"
echo "  Protected resource released: false"

say "Applying idempotent Phase 5 lifecycle migration"

docker exec \
  -i \
  "$DB_CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$MIGRATION_FILE"

TABLE_COUNT="$(
  docker exec \
    -i \
    "$DB_CONTAINER" \
    psql \
    -v ON_ERROR_STOP=1 \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Atqc "
      SELECT count(*)
      FROM (
        VALUES
          (
            to_regclass(
              'public.phase5_agent_delegation_revocations'
            )
          ),
          (
            to_regclass(
              'public.phase5_agent_delegation_usage'
            )
          ),
          (
            to_regclass(
              'public.phase5_agent_delegation_use_claims'
            )
          )
      ) AS lifecycle_tables(table_name)
      WHERE table_name IS NOT NULL;
    " \
    | tr -d '[:space:]'
)"

[[ "$TABLE_COUNT" == "3" ]] ||
  fail "Expected three lifecycle tables; found: $TABLE_COUNT"

echo "Lifecycle tables present: $TABLE_COUNT/3"

export DATABASE_URL

say "Running isolated lifecycle and durable-store certification"

npm run \
  phase5:agent-delegation-lifecycle-test

echo
echo "PR297_LIFECYCLE_ISOLATED_CERTIFICATION=true"

say "Running enabled-Gateway eight-case final acceptance"

npm run \
  phase5:final-acceptance-test

echo
echo "PR297_LIFECYCLE_ENABLED_GATEWAY_CERTIFICATION=true"

echo
echo "============================================================"
echo " Phase 5 lifecycle final acceptance passed"
echo "============================================================"
echo
echo "PR297_AGENT_DELEGATION_LIFECYCLE_E2E=true"
echo "PR297_PRODUCTION_ACTIVATION=false"
echo "PR297_AGENT_REGISTRY_LOOKUP=false"
