#!/usr/bin/env bash
# Runs one OWASP ZAP scan in Docker against the compose stack (pnpm mock:up) and judges the result.
#
#   bash testing/zap/run.sh baseline    passive scan + AJAX spider of the shell (zap-baseline.py), the PR gate
#   bash testing/zap/run.sh api         active scan of the REST API from testing/zap/openapi.json (zap-api-scan.py), weekly
#
# The reports go to $ZAP_RESULTS (default zap-results): <mode>.html, <mode>.json, <mode>.md, plus the log.
# Exit code: 1 when a rule set to FAIL in testing/zap/rules.tsv matched (a High alert) and FAIL_ACTION is not
# "false"; warnings pass; any other non-zero code is a scan error and fails. A missing expected URL also fails.
# Variables (all optional):
#   ZAP_IMAGE        zaproxy/zap-stable:2.17.0
#   ZAP_BASE_URL     http://localhost:8000   the shell, which proxies /auth and /api like Caddy does; the seeded user signs in here
#   ZAP_TARGET       where the scan starts: $ZAP_BASE_URL/api/chats when AUTH=1, $ZAP_BASE_URL when AUTH=0
#   ZAP_RULES        testing/zap/rules.tsv   rules file (-c)
#   ZAP_RESULTS      zap-results
#   ZAP_NAME         report base name (default: the mode)
#   AUTH             1 signs in the seeded user and injects its session cookie; 0 scans anonymously
#   FAIL_ACTION      true (default) fails on exit code 1; false only reports
#   ZAP_MINUTES      spider minutes (-m, baseline) or scan minutes (-T, api), default 3 / 10
#   ZAP_EXPECT       URL paths that must appear in the report when AUTH=1 (default /chats,/settings,/api/chats)
#   ZAP_DOCKER_ARGS  docker run arguments (default --network host: the shell loads its micro frontends from
#                    localhost:3001-3003, which must be the stack for the AJAX spider's browser)
set -euo pipefail
cd "$(dirname "$0")/../.."

mode="${1:-baseline}"
case "$mode" in baseline | api) ;; *) echo "usage: $0 baseline|api" >&2; exit 2 ;; esac
image="${ZAP_IMAGE:-zaproxy/zap-stable:2.17.0}"
base="${ZAP_BASE_URL:-http://localhost:8000}"
results="${ZAP_RESULTS:-zap-results}"
name="${ZAP_NAME:-$mode}"
rules="${ZAP_RULES:-testing/zap/rules.tsv}"
auth="${AUTH:-1}"
# The signed-in scan starts at the chats API: its JSON answers raise no alert of their own, but a scan that
# starts there puts /api/chats in the site tree (and so in the report) as well as the pages the spider reaches.
if [ "$auth" = "1" ]; then default_target="$base/api/chats"; else default_target="$base"; fi
target="${ZAP_TARGET:-$default_target}"
# shellcheck disable=SC2206
docker_args=(${ZAP_DOCKER_ARGS:---network host})

mkdir -p "$results"
chmod 777 "$results" # the zap user of the image writes the reports
cp "$rules" "$results/rules.tsv"
cp testing/zap/openapi.json "$results/openapi.json" 2> /dev/null || true
cp testing/zap/hooks.py "$results/hooks.py"

zap_args=(-c rules.tsv -r "$name.html" -J "$name.json" -w "$name.md")
if [ "$auth" = "1" ]; then
  # The account only exists on the throw-away stack, so a fixed password is fine here.
  opts="$(DAST_BASE_URL="$base" DAST_PASSWORD="${DAST_PASSWORD:-DastScan-1234}" node scripts/dast/zap-session.ts)"
  # The cookie must not appear in a CI log: mask it before anything can print it.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::${opts##*replacement=}"; fi
  zap_args+=(-z "$opts")
fi

if [ "$mode" = "baseline" ]; then
  # -j AJAX spider (the shell is a React app), -I never fail on warnings inside ZAP itself.
  # --hook: hooks.py requests the signed-in pages (ZAP_SEED_PATHS) before the spiders start, so the report does
  # not depend on the spiders finding them. It makes zap-baseline.py use its classic mode instead of the plan.
  if [ "$auth" = "1" ]; then docker_args+=(-e "ZAP_SEED_PATHS=${ZAP_EXPECT:-/chats,/settings,/api/chats}"); fi
  cmd=(zap-baseline.py -t "$target" -j -m "${ZAP_MINUTES:-3}" -I --hook /zap/wrk/hooks.py "${zap_args[@]}")
else
  cmd=(zap-api-scan.py -t /zap/wrk/openapi.json -f openapi -O "$base" -T "${ZAP_MINUTES:-10}" -I "${zap_args[@]}")
fi

status=0
docker run --rm "${docker_args[@]}" -v "$PWD/$results:/zap/wrk:rw" "$image" "${cmd[@]}" 2>&1 | tee "$results/$name.log" || status=${PIPESTATUS[0]}
expect=()
if [ "$auth" = "1" ] && [ "$mode" = "baseline" ]; then expect=(--expect "${ZAP_EXPECT:-/chats,/settings,/api/chats}"); fi
echo
summary_status=0
node scripts/dast/zap-report.ts "$results/$name.json" ${expect[@]+"${expect[@]}"} | tee "$results/$name-summary.md" || summary_status=$?
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$results/$name-summary.md" >> "$GITHUB_STEP_SUMMARY"; fi

# ZAP exits 0 (clean or warnings with -I), 1 (a FAIL rule matched), 3 (scan error).
verdict=0
if [ "$status" = "1" ]; then
  echo "ZAP exited with 1: a rule set to FAIL in $rules matched (see the FAIL lines above)."
  if [ "${FAIL_ACTION:-true}" = "false" ]; then echo "FAIL_ACTION=false: not failing the job."; else verdict=1; fi
elif [ "$status" != "0" ] && [ "$status" != "2" ]; then
  echo "ZAP ended with exit code $status (scan error)."
  verdict=1
fi
[ "$summary_status" = "0" ] || verdict=1
exit "$verdict"
