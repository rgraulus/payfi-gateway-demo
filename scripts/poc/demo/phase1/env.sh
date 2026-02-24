#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS on Windows path conversion safety
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

export GW="${GW:-http://127.0.0.1:3005}"
export RESOURCE_PATH="${RESOURCE_PATH:-/paid/demo.pdf}"

# Compose file location
export POC_COMPOSE_FILE="${POC_COMPOSE_FILE:-docker/poc/demo/phase1/docker-compose.yml}"
