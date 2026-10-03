#!/usr/bin/env bash
# Runs one load scenario with k6 + xk6-sse in Docker, on the network of the compose stack.
#
#   bash testing/k6/run.sh <smoke|users_ramp|streams_ramp|soak>
#
# The stack must be up (LOAD=1 bash scripts/mock-compose.sh up llm). The k6 image is built on the
# first run (testing/k6/Dockerfile). Output: docs/AICHAT-24/results/<scenario>-summary.json and
# <scenario>-k6.txt. Variables (all optional) are listed in testing/k6/README.md.
set -euo pipefail
cd "$(dirname "$0")/../.."

scenario="${1:-smoke}"
image="${K6_IMAGE:-ai-chat-k6-sse}"
network="${K6_NETWORK:-llm-chat_llm-chat}"
results="docs/AICHAT-24/results"
mkdir -p "$results"

if ! docker image inspect "$image" > /dev/null 2>&1; then
  docker build -t "$image" -f testing/k6/Dockerfile testing/k6
fi

env_args=(-e "SCENARIO=$scenario" -e "BASE_URL=${BASE_URL:-http://shell:3000}")
for name in USER_LEVELS STREAM_LEVELS STAGE_SECONDS RAMP_SECONDS SOAK_RATE SOAK_DURATION MAX_VUS \
  REST_P95_MS TTFT_P95_MS STREAM_TIMEOUT_MS LLM_MODEL LLM_API_KEY K6_PASSWORD; do
  if [ -n "${!name:-}" ]; then env_args+=(-e "$name=${!name}"); fi
done

# K6_PROM_RW=1 also sends the k6 metrics to Prometheus (Grafana dashboard "Load test").
if [ "${K6_PROM_RW:-0}" = "1" ]; then
  env_args+=(-e "K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write" -e "K6_PROMETHEUS_RW_TREND_STATS=p(95),avg,max" -e "K6_PROMETHEUS_RW_PUSH_INTERVAL=5s")
  set -- "$@" -o experimental-prometheus-rw
fi

docker run --rm --user "$(id -u):$(id -g)" --network "$network" \
  -v "$PWD/testing/k6:/scripts:ro" -v "$PWD/$results:/results" \
  "${env_args[@]}" "$image" run /scripts/load.ts \
  --summary-export "/results/$scenario-summary.json" "${@:2}" 2>&1 | tee "$results/$scenario-k6.txt"
exit "${PIPESTATUS[0]}"
