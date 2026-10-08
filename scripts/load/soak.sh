#!/usr/bin/env bash
# 30 min soak with the gate: runs the k6 soak, then fails when done <= 99 % or any container's
# memory grew 10 % or more from start to end (scripts/load/soak-check.ts).
#   bash scripts/load/soak.sh        (stack up: pnpm load:up && bash testing/k6/run.sh seed)
set -uo pipefail
cd "$(dirname "$0")/../.."
SOAK_DURATION="${SOAK_DURATION:-30m}" SOAK_RATE="${SOAK_RATE:-20}" K6_PROM_RW="${K6_PROM_RW:-1}" bash testing/k6/run.sh soak
k6_status=$?
node scripts/load/soak-check.ts "$@"
check_status=$?
[ "$k6_status" -eq 0 ] && exit "$check_status" || exit "$k6_status"
