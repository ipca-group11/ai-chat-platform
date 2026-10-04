#!/usr/bin/env bash
# Local development without Docker and without a database: the mock server stands in for
# auth-service, conversation-service and the LLM providers (AICHAT-144). Sign in with
# alice@mock.test / the dataset password (docs/AICHAT-144/MOCK-SERVER.md).
#
# Open http://localhost:5000/ — the shell dev server loads the remotes from localhost:5001-5003
# and proxies /auth and /api to the mock on :4010.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
  nvm install >/dev/null && nvm use >/dev/null
fi

export NODE_ENV=development
export COOKIE_SECURE=false
export PORT=4010
export MOCK_DATASET="${MOCK_DATASET:-default}"
export AUTH_SERVICE_URL="http://localhost:$PORT"
export CONVERSATION_SERVICE_URL="http://localhost:$PORT/api"

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

run() { # name, cmd...
  local name="$1"; shift
  ("$@" 2>&1 | sed -u "s/^/[$name] /") &
  pids+=($!)
}

run mock         pnpm --filter @platform/mock-server dev
run mfe-auth     pnpm --filter mfe-auth dev
run mfe-chat     pnpm --filter @app/mfe-chat dev
run mfe-settings pnpm --filter @app/mfe-settings dev
run shell        pnpm --filter @app/shell dev

wait
