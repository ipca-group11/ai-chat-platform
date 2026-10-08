#!/usr/bin/env bash
# Schemathesis (AICHAT-187): property-based tests of auth-service and conversation-service, generated from their
# committed OpenAPI specs (services/*/openapi.json, AICHAT-184), against the running compose stack.
#
#   bash testing/schemathesis/run.sh          both services; exit 1 if any check fails
#
# Checks: not_a_server_error (no 5xx), status_code_conformance (only documented statuses) and
# response_schema_conformance (bodies match the spec). Requests are signed in with the access token of a seeded user.
# JUnit reports: $ST_RESULTS/<service>.xml (default schemathesis-results/).
#
# Left out on purpose:
#   deleteAccount (DELETE /auth/me)  would delete the signed-in user in the middle of the run
#   eraseUser (POST /internal/erasures)  deletes data; service token only, covered by the integration tests
#   streamChat (GET /chats/{chatId}/stream)  server-sent events never end, a request would wait forever
#
# Variables: ST_IMAGE, ST_RESULTS, ST_MAX_EXAMPLES (default 30 per operation), ST_SEED (default 1, reproducible),
# ST_AUTH_URL / ST_CONVERSATION_URL (default http://localhost:4001 / 4002), ST_DOCKER_ARGS (default --network host;
# on Docker Desktop for macOS use ST_DOCKER_ARGS= and the host.docker.internal URLs).
set -euo pipefail
cd "$(dirname "$0")/../.."

image="${ST_IMAGE:-schemathesis/schemathesis:4.28.0}"
results="${ST_RESULTS:-schemathesis-results}"
# shellcheck disable=SC2206
docker_args=(${ST_DOCKER_ARGS---network host})

mkdir -p "$results"
chmod 777 "$results" # the image's user writes the reports

# The account only exists on the throw-away stack, so a fixed password is fine here.
cookie="$(ST_PASSWORD="${ST_PASSWORD:-Schemathesis-1234}" node scripts/schemathesis/session.ts)"
# The cookie must not appear in a CI log: mask it before anything can print it.
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::${cookie#access_token=}"; fi

run_service() {
  local name="$1" url="$2"
  shift 2
  echo "::group::schemathesis $name ($url)"
  docker run --rm ${docker_args[@]+"${docker_args[@]}"} \
    -v "$PWD/services/$name/openapi.json:/spec/openapi.json:ro" \
    -v "$PWD/$results:/results" \
    "$image" run /spec/openapi.json \
    --url "$url" \
    --checks not_a_server_error,status_code_conformance,response_schema_conformance \
    --header "Cookie: $cookie" \
    --max-examples "${ST_MAX_EXAMPLES:-30}" \
    --seed "${ST_SEED:-1}" \
    --report junit --report-junit-path "/results/$name.xml" \
    "$@"
  local status=$?
  echo "::endgroup::"
  return $status
}

status=0
run_service auth-service "${ST_AUTH_URL:-http://localhost:4001}" \
  --exclude-operation-id deleteAccount || status=1
run_service conversation-service "${ST_CONVERSATION_URL:-http://localhost:4002}" \
  --exclude-operation-id eraseUser --exclude-operation-id streamChat || status=1
exit $status
