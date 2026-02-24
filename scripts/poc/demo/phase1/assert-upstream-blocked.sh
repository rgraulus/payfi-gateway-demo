#!/usr/bin/env bash
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

RESOURCE_PATH="${RESOURCE_PATH:-/paid/demo.pdf}"

# In Phase 1 topology, upstream runs inside container and is NOT port-mapped to host.
# Therefore, this must fail from host:
URL="http://127.0.0.1:3010${RESOURCE_PATH}"

set +e
curl -sS --max-time 2 -D - -o /dev/null "$URL" >/tmp/poc_upstream_headers.txt 2>/tmp/poc_upstream_err.txt
rc=$?
set -e

if [ "$rc" -eq 0 ]; then
  echo "Unexpected: upstream responded on host!"
  cat /tmp/poc_upstream_headers.txt || true
  exit 1
fi

echo "PASS ✅ upstream blocked from host (curl rc=$rc)"
