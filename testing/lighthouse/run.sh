#!/usr/bin/env bash
# Lighthouse CI against the compose stack (pnpm mock:up): 5 pages x 3 runs, median against the budgets of lighthouserc.json.
# The reports are in $LH_RESULTS (default lighthouse-results): lhci/*.html, lhci/*.json and summary.md.
# Exit code 1 when a page is over its budget. Variables (all optional): LH_BASE_URL, LH_CONFIG, LH_RESULTS, LH_RUNS, LH_EMAIL.
set -euo pipefail
cd "$(dirname "$0")/../.."
# The account only exists on the throw-away stack, so a fixed password is fine here.
export LH_PASSWORD="${LH_PASSWORD:-Lighthouse-1234}"
exec node scripts/lighthouse/run.ts
