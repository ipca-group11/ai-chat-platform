#!/usr/bin/env bash
# Runs Semgrep CE (pinned Docker image) on the repo. Same command locally and in CI.
#   scripts/ci/semgrep.sh [output-dir]          -> writes <output-dir>/semgrep.sarif
# This script only scans and writes the reports (exit 0 unless Semgrep itself fails).
# SARIF keeps nosemgrep-ed findings but marks them as suppressed.
# The gate is scripts/ci/sast-summary.mjs (reads the SARIF): it exits 1 when there is an ERROR finding (WARNINGs never fail).
set -uo pipefail

SEMGREP_IMAGE="${SEMGREP_IMAGE:-semgrep/semgrep:1.140.0}"
OUT="${1:-semgrep-results}"
mkdir -p "$OUT"

CONFIGS=(
  --config .semgrep.yml
  --config p/typescript
  --config p/react
  --config p/expressjs
  --config p/nodejsscan
  --config p/jwt
  --config p/secrets
  --config p/github-actions
  --config p/dockerfile
  --config p/owasp-top-ten
)

# One scan with every severity (the summary script decides what blocks).
docker run --rm -v "$PWD:/src" -w /src "$SEMGREP_IMAGE" \
  semgrep scan "${CONFIGS[@]}" --metrics=off \
  --sarif-output "$OUT/semgrep.sarif" --quiet >/dev/null
code=$?
echo "semgrep exit code: $code (results in $OUT/)"
exit "$code"
