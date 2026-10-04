#!/usr/bin/env bash
# Stops a deploy before it touches the VM when a per-environment secret is missing, too
# short, or one of the values committed for local runs (AICHAT-251). The deploy job runs it
# with the secrets of its GitHub environment; run it by hand the same way:
#   INTERNAL_SERVICE_TOKEN=... bash deploy/azure/check-deploy-secrets.sh
set -uo pipefail

status=0

# check NAME MIN_LENGTH [COMMITTED_VALUE...]
check() {
  local name=$1 min=$2
  shift 2
  local value=${!name:-}
  if [ -z "$value" ]; then
    echo "::error::$name is not set: add it as a secret of this GitHub environment"
    status=1
    return
  fi
  if [ "${#value}" -lt "$min" ]; then
    echo "::error::$name is shorter than $min characters"
    status=1
  fi
  for committed in "$@"; do
    if [ "$value" = "$committed" ]; then
      echo "::error::$name is a value committed to the repository; generate one for this environment"
      status=1
    fi
  done
}

# The same minimum length the services enforce (services/*/src/shared/env.ts).
check INTERNAL_SERVICE_TOKEN 32 \
  local-dev-only-internal-token-change-me \
  test-internal-service-token-0123456789

if [ "$status" -eq 0 ]; then echo "Deployment secrets OK"; fi
exit "$status"
