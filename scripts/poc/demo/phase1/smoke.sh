#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/env.sh"

fail() { echo "FAIL ❌ $*" >&2; exit 1; }
pass() { echo "PASS ✅ $*"; }

# --- helpers ---------------------------------------------------------------

# Wait until gateway is actually responding (ts-node startup can take a moment).
wait_for_gateway() {
  local url="$1"
  local max_secs="${2:-30}"
  local i=0

  echo "Waiting for gateway healthz: $url (max ${max_secs}s)..."
  while [ "$i" -lt "$max_secs" ]; do
    # Temporarily disable -e so curl failures don't abort the script.
    set +e
    curl -sS --max-time 2 "$url" >/dev/null 2>&1
    local rc=$?
    set -e

    if [ "$rc" -eq 0 ]; then
      echo "Gateway is responding."
      return 0
    fi

    i=$((i + 1))
    sleep 1
  done

  echo "---- docker logs (tail 200) ----" >&2
  docker logs --tail 200 payfi-poc-gw 2>/dev/null || true
  return 1
}

# Curl headers with retry; prints headers (with CR stripped) to stdout.
# IMPORTANT:
# - Do NOT use HEAD (-I) because /x402 may not implement HEAD => 404.
# - Use a tiny GET (Range 0-0) and sink the body to a platform-appropriate null.
# - Treat "we got an HTTP status line" as success even if curl exits non-zero
#   (Windows curl sometimes returns rc=23 even when headers are printed).
curl_headers_retry() {
  local url="$1"
  local attempts="${2:-8}"
  local delay="${3:-1}"

  # pick a null sink that works on this platform
  local null_out="/dev/null"
  case "${OSTYPE:-}" in
    msys*|cygwin*|win32*) null_out="NUL" ;;
  esac

  local n=1
  while [ "$n" -le "$attempts" ]; do
    set +e

    # --range 0-0: keep transfer tiny, still GET
    # -D - : dump headers to stdout
    # -o null_out : drop body
    # capture stderr too
    local out
    out="$(curl -sS --max-time 10 --range 0-0 -D - -o "$null_out" "$url" 2>&1)"
    local rc=$?

    set -e

    # If we got an HTTP status line, consider it success (even if rc!=0).
    if printf "%s\n" "$out" | grep -qE '^HTTP/[0-9.]+'; then
      printf "%s\n" "$out" | tr -d '\r'
      return 0
    fi

    echo "curl attempt $n/$attempts failed (rc=$rc): $out" >&2
    n=$((n + 1))
    sleep "$delay"
  done

  return 1
}

# --- main ------------------------------------------------------------------

echo "== Phase 1 PoC Smoke =="
echo "GW=$GW"
echo "RESOURCE_PATH=$RESOURCE_PATH"
echo

echo "[1/5] Start Phase 1 container topology (gateway published, upstream private)"
docker compose -f "$POC_COMPOSE_FILE" up -d --build
pass "docker compose up -d --build"

# NEW: wait for server to be ready (prevents curl 52/empty reply races)
echo
wait_for_gateway "$GW/healthz" 40 || fail "Gateway did not become ready."

echo
echo "[2/5] Assert upstream is NOT reachable from host (anti-bypass)"
RESOURCE_PATH="$RESOURCE_PATH" "$DIR/assert-upstream-blocked.sh" || fail "Upstream is reachable from host; isolation not in effect."
pass "upstream blocked"

echo
echo "[3/5] Assert unpaid request returns 402 + PAYMENT-REQUIRED"
URL="$GW/x402${RESOURCE_PATH}"

# Robust header fetch (handles transient empty-reply during startup/recreate,
# and Windows curl rc=23 even when headers are successfully printed).
HDRS="$(curl_headers_retry "$URL" 10 1)" || {
  echo "---- docker logs (tail 200) ----" >&2
  docker logs --tail 200 payfi-poc-gw 2>/dev/null || true
  fail "Failed to fetch headers from gateway (empty reply / not ready?): $URL"
}

STATUS="$(printf "%s\n" "$HDRS" | head -n1 || true)"
echo "Status: $STATUS"
printf "%s\n" "$HDRS" | sed -n '1,25p'

echo "$STATUS" | grep -q " 402 " || fail "Expected 402 Payment Required from gateway for $URL"
printf "%s\n" "$HDRS" | awk -F': ' 'tolower($1)=="payment-required"{found=1} END{exit(found?0:1)}' \
  || fail "Missing PAYMENT-REQUIRED header"
pass "402 + PAYMENT-REQUIRED present"

echo
echo "[4/5] Run canonical autorun buyer flow (must unlock bytes)"
RESOURCE_PATH="$RESOURCE_PATH" GW="$GW" ./scripts/e2e-autorun-proxy.sh
pass "autorun buyer flow succeeded"

echo
echo "[5/5] Re-assert upstream still blocked"
RESOURCE_PATH="$RESOURCE_PATH" "$DIR/assert-upstream-blocked.sh" || fail "Upstream became reachable from host unexpectedly."
pass "upstream still blocked"

echo
echo "BOOM ✅ Phase 1 truth pipeline passes end-to-end"
