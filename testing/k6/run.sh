#!/usr/bin/env bash
# Runs one load scenario with k6 + xk6-sse in Docker, on the network of the compose stack.
#
#   bash testing/k6/run.sh <seed|smoke|users_ramp|streams_ramp|soak|mixed>
#
# The stack must be up (LOAD=1 bash scripts/mock-compose.sh up llm). The k6 image is built on the
# first run (testing/k6/Dockerfile). Output: docs/AICHAT-24/results/<scenario>-summary.json and
# <scenario>-k6.txt. Variables (all optional) are listed in testing/k6/README.md.
set -euo pipefail
cd "$(dirname "$0")/../.."

scenario="${1:-smoke}"
# RUN_NAME names the output files when one scenario is run with different settings.
name="${RUN_NAME:-$scenario}"
image="${K6_IMAGE:-ai-chat-k6-sse}"
network="${K6_NETWORK:-llm-chat_llm-chat}"
results="docs/AICHAT-24/results"
mkdir -p "$results"

if ! docker image inspect "$image" > /dev/null 2>&1; then
  docker build -t "$image" -f testing/k6/Dockerfile testing/k6
fi

env_args=(-e "SCENARIO=$scenario" -e "BASE_URL=${BASE_URL:-http://shell:3000}")
for var in USER_LEVELS STREAM_LEVELS STAGE_SECONDS RAMP_SECONDS SOAK_RATE SOAK_DURATION MIXED_USERS MIXED_STREAMS MIXED_DURATION MAX_VUS SEED_USERS POOL_USERS \
  REST_P95_MS TTFT_P95_MS STREAM_TIMEOUT_MS LLM_MODEL LLM_API_KEY K6_PASSWORD; do
  if [ -n "${!var:-}" ]; then env_args+=(-e "$var=${!var}"); fi
done

# K6_PROM_RW=1 also sends the k6 metrics to Prometheus (Grafana dashboard "Load test").
if [ "${K6_PROM_RW:-0}" = "1" ]; then
  env_args+=(-e "K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write" -e "K6_PROMETHEUS_RW_TREND_STATS=p(95),avg,max" -e "K6_PROMETHEUS_RW_PUSH_INTERVAL=5s")
  set -- "$@" -o experimental-prometheus-rw
fi

# The CPU and memory of every container go to <scenario>-docker-stats.csv while k6 runs
# (SAMPLE=0 turns it off; needs node, see scripts/load/docker-stats-sampler.ts).
sampler=""
if [ "${SAMPLE:-1}" = "1" ] && command -v node > /dev/null 2>&1 && [ "$scenario" != "seed" ]; then
  node scripts/load/docker-stats-sampler.ts --out "$results/$name-docker-stats.csv" --interval "${SAMPLE_INTERVAL:-5}" --serve "${SAMPLER_PORT:-9105}" &
  sampler=$!
  trap '[ -n "$sampler" ] && kill -TERM "$sampler" 2> /dev/null || true' EXIT
fi

docker run --rm --user "$(id -u):$(id -g)" --network "$network" \
  -v "$PWD/testing/k6:/scripts:ro" -v "$PWD/$results:/results" \
  "${env_args[@]}" "$image" run /scripts/load.ts \
  --summary-export "/results/$name-summary.json" "${@:2}" 2>&1 | tee "$results/$name-k6.txt" || status=$?
# The summary holds the value returned by setup(), which is the sessions of the shared accounts.
if [ -f "$results/$name-summary.json" ] && command -v node > /dev/null 2>&1; then
  node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f,"utf8"));delete j.setup_data;fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$results/$name-summary.json"
fi
exit "${status:-0}"
