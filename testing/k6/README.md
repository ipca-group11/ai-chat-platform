# K6 streaming load test

`streaming-load.js` is the single source of truth for the ~1s first-token and
5-concurrent-stream performance NFRs (FR7/UC6, AC-62/AC-96, `docs/pods/quality-observability/PLAN.md`
task O6). It drives >=5 virtual users through register/login -> create chat -> send message
-> consume the SSE stream, recording a `time_to_first_token` trend metric and a
`stream_success_rate` rate metric.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed locally (`brew install k6`,
  or the official Docker image `grafana/k6`). Not an npm package — the `k6` package on npm
  is a dummy for editor autocompletion only.
- A running stack: `docker compose up -d` from the repo root (services, Postgres, and
  Ollama with `llama3.2:1b` pre-pulled per `STACK.md` decision #7).

## Running

```bash
# Directly:
k6 run testing/k6/streaming-load.js

# Via Nx:
pnpm exec nx run k6:perf

# Against non-default ports/hosts:
K6_BASE_URL=http://localhost:3001 K6_CHAT_BASE_URL=http://localhost:3002 \
  K6_VUS=5 K6_ITERATIONS=3 \
  k6 run testing/k6/streaming-load.js
```

## What it measures

- **`time_to_first_token`** (Trend, ms): elapsed time from sending a message to the first
  byte of the SSE response arriving. Threshold: p95 < 1500ms (some headroom over the raw
  ~1s NFR target to account for real network/model warm-up variance against a small local
  model; tighten once the stack's steady-state latency is known).
- **`stream_success_rate`** (Rate): fraction of streams that produced a non-empty response
  body with a 200 status. Threshold: `rate == 1` (AC-96's "0% dropped/failed streams across
  5 concurrent chats").
- **`http_req_failed`**: k6's built-in metric, thresholded at <1% to catch any other
  request-level failures (register/login/create-chat) alongside the streaming-specific
  metrics above.

## CI / scheduling

This test needs the full stack (all services + Postgres + Ollama) running, so it is
**not** part of the fast per-PR `nx affected` loop (unlike `packages/test-config`'s unit
coverage gate). Run it:

- Manually, against a local `docker compose up` stack, before/after any change to the
  streaming pipeline (`conversation-service`'s SSE handler, queueing, or provider
  adapters).
- On a schedule (e.g. a nightly GitHub Actions `workflow_dispatch`/`schedule` job) once a
  CI-provisioned full-stack environment exists — deliberately not added as a new
  `.github/workflows/*.yml` file here to avoid prescribing a specific CI runner/schedule
  ahead of that infrastructure being available; wiring it up is flagged in this pod's
  PLAN.md "Known gaps" for the integration pass.

## Notes on the first-token measurement

k6's plain `http` module buffers the full response body rather than exposing per-chunk
arrival timestamps, so `time_to_first_token` here uses `res.timings.waiting`
(time-to-first-byte) as a proxy — a reasonable approximation since
`conversation-service` begins writing the SSE stream as soon as the first token is
generated. If more precise per-chunk timing is needed later, consider k6's experimental
`http.asyncRequest`/streaming APIs or a small custom k6 extension.
