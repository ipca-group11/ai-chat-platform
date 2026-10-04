#!/usr/bin/env bash
# Local development without Docker, with HMR (Vite) and watch mode (tsx) everywhere.
#
# Prerequisites (native, on the host):
#   - Postgres 16 on localhost:5432 with role/db `llmchat` (see docs/DEV.md)
#   - Ollama on localhost:11434 with the model in OLLAMA_DEFAULT_MODEL pulled
#
# Open http://localhost:5000/ — the shell dev server loads the remotes from
# localhost:5001-5003 and proxies /auth -> :4001 and /api -> :4002.
set -euo pipefail
cd "$(dirname "$0")/.."

# Use the Node version from .nvmrc (some deps require >= 24.15) when nvm is available.
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
  nvm install >/dev/null && nvm use >/dev/null
fi

export NODE_ENV=development
export JWT_SECRET="${JWT_SECRET:-local-dev-only-change-me}"
export COOKIE_SECURE=false
export CORS_ORIGIN="http://localhost:5000,http://127.0.0.1:5000"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
export OLLAMA_DEFAULT_MODEL="${OLLAMA_DEFAULT_MODEL:-llama3.2:1b}"
PG="${PG_URL:-postgresql://llmchat:llmchat_local_dev@localhost:5432/llmchat}"
AUTH_DB="$PG?schema=auth"
CONV_DB="$PG?schema=conversation"

# Apply both services' committed migrations (same script as the Dockerfiles, AICHAT-250).
for svc in auth-service:"$AUTH_DB" conversation-service:"$CONV_DB"; do
  name="${svc%%:*}"; url="${svc#*:}"
  (cd "services/$name" && DATABASE_URL="$url" npx prisma generate >/dev/null \
    && DATABASE_URL="$url" ../../scripts/db/prisma-migrate.sh)
done

mkdir -p services/conversation-service/data/uploads

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

run() { # name, cmd...
  local name="$1"; shift
  ("$@" 2>&1 | sed -u "s/^/[$name] /") &
  pids+=($!)
}

run auth   env PORT=4001 DATABASE_URL="$AUTH_DB" pnpm --filter @app/auth-service dev
run conv   env PORT=4002 DATABASE_URL="$CONV_DB" pnpm --filter @app/conversation-service dev
run mfe-auth     pnpm --filter mfe-auth dev
run mfe-chat     pnpm --filter @app/mfe-chat dev
run mfe-settings pnpm --filter @app/mfe-settings dev
run shell        pnpm --filter @app/shell dev

wait
