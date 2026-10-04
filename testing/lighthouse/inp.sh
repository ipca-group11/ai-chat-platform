#!/usr/bin/env bash
# INP check against the compose stack (pnpm mock:up), AICHAT-240: scripted interactions in headless Chrome with a
# throttled CPU, INP per page (median of 3 runs) against the 200 ms budget. Writes $LH_RESULTS/inp-summary.md.
# Exit code 1 when a page is over budget. Variables (all optional): INP_BASE_URL, INP_RUNS, INP_CPU_THROTTLE,
# INP_BUDGET_MS, INP_EMAIL, LH_RESULTS, CHROME_PATH.
set -euo pipefail
cd "$(dirname "$0")/../.."
# The account only exists on the throw-away stack, so a fixed password is fine here.
export INP_PASSWORD="${INP_PASSWORD:-Lighthouse-1234}"
exec node scripts/perf/inp-check.ts
