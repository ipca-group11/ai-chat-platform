#!/usr/bin/env bash
# Starts or stops the stack with the mock server (compose.mock.yaml, AICHAT-144).
#
#   scripts/mock-compose.sh up [llm|frontend-only]   default profile: llm
#   scripts/mock-compose.sh down
#
# `llm` runs the real stack with conversation-service pointed at the LLM mock;
# `frontend-only` runs the shell and the MFEs against the backend mock (no database).
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_FILE=compose.yaml:compose.mock.yaml
# LOAD=1 adds the CPU and memory limits of the production VM (compose.load.yaml, AICHAT-24).
if [ "${LOAD:-0}" = "1" ]; then COMPOSE_FILE="$COMPOSE_FILE:compose.load.yaml"; fi
action="${1:-up}"
profile="${2:-${MOCK_PROFILE:-llm}}"

case "$action" in
  up)
    case "$profile" in llm | frontend-only) ;; *) echo "unknown profile: $profile (llm | frontend-only)" >&2; exit 2 ;; esac
    docker compose --profile "$profile" up -d --build --wait
    echo "Mock server: http://127.0.0.1:${MOCK_SERVER_PORT:-4010}/__admin/health"
    echo "App:         http://localhost:${APP_PORT:-8000}/"
    ;;
  down)
    docker compose --profile llm --profile frontend-only down -v --remove-orphans
    ;;
  *)
    echo "usage: $0 up [llm|frontend-only] | down" >&2
    exit 2
    ;;
esac
