# k6 load test

One script, `load.ts`, with four scenarios picked by `SCENARIO`. It follows the real API flow
through the shell (`vite preview`, the same entry as on the VM): register and sign in on
auth-service, create a chat, send a message, read the chat stream until `done`. Epic AICHAT-24;
the numbers are in `docs/AICHAT-24/RESULTS.md`.

| File | What it is |
|---|---|
| `load.ts` | Entry point; exports the scenario functions `smoke`, `browse` and `stream` |
| `lib/api.ts` | The API calls, the stream reader (xk6-sse) and the custom metrics |
| `lib/scenarios.ts` | Scenarios, levels and thresholds (no k6 imports, so Vitest checks it) |
| `Dockerfile` | k6 with the `xk6-sse` extension (`k6/x/sse`), needed to read the stream event by event |
| `run.sh` | Runs a scenario in Docker on the network of the compose stack |

## Run

```sh
pnpm load:up                       # real stack + LLM mock, with the CPU/memory limits of the VM
bash testing/k6/run.sh smoke       # also: users_ramp, streams_ramp, soak
pnpm mock:down                     # stop and remove everything
```

If a port is taken (4001, 4002, 3300, 9090), set `AUTH_SERVICE_PORT`, `CONVERSATION_SERVICE_PORT`,
`GRAFANA_PORT` or `PROMETHEUS_PORT` before `pnpm load:up`. The first `run.sh` builds the k6 image
(about two minutes). Results go to `docs/AICHAT-24/results/<scenario>-summary.json` and `-k6.txt`.

## Scenarios

| Scenario | Executor | What it does |
|---|---|---|
| `smoke` | 1 VU, 1 iteration | One full flow; passes when the stream ends with `done` |
| `users_ramp` | `ramping-vus` | Browsing users (chat list, messages) climb level by level |
| `streams_ramp` | `ramping-arrival-rate` | New streams per second climb level by level; a stream lasts as long as the answer |
| `soak` | `constant-arrival-rate` | A steady stream rate for `SOAK_DURATION` (30 min by default) |

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `SCENARIO` | `smoke` | Set by `run.sh <scenario>` |
| `BASE_URL` | `http://shell:3000` | Entry point; `/auth` and `/api` go through the shell |
| `USER_LEVELS` | `25,50,100,150,200` | Virtual users per level of `users_ramp` |
| `STREAM_LEVELS` | `1,2,4,6,8` | New streams per second per level of `streams_ramp` |
| `STAGE_SECONDS` / `RAMP_SECONDS` | `60` / `10` | Length of a level / the ramp inside it |
| `SOAK_RATE` / `SOAK_DURATION` | `2` / `30m` | Streams per second and length of `soak` |
| `MAX_VUS` | `400` | Upper bound of the arrival-rate scenarios |
| `REST_P95_MS` / `TTFT_P95_MS` | `1000` / `1500` | Saturation thresholds |
| `STREAM_TIMEOUT_MS` | `60000` | A stream not done by then counts as failed |
| `K6_PROM_RW` | `0` | `1` also sends the k6 metrics to Prometheus (Grafana dashboard "Load test") |

## Metrics and thresholds

- `time_to_first_token` (ms): from sending the message to the first `token` event on the stream.
- `stream_duration`, `stream_success_rate` (stream ended with `done`, no error), `tokens_received`.
- Requests are tagged `kind:rest` (list chats, messages, create chat, send message), `kind:auth` or `kind:stream`, and `level` (the step of the ramp).
- Thresholds: `http_req_duration{kind:rest}` p95 < 1000 ms, `http_req_failed{kind:rest}` < 1 %, `time_to_first_token` p95 < 1500 ms, `stream_success_rate` > 99 %. Each level has its own copy (`{level:N}`), so the summary shows the first level that breaks. No threshold aborts the run.
- The overall `http_req_failed` also counts the stream requests, which k6 reports as cancelled when the client closes them; use the `kind:rest` one.

## Notes

- The shell proxy sends the response head of a stream together with its first event, and the xk6-sse client waits for the head. A stream opened before the message would wait forever, so the script sends the message first and opens the stream right after (the mock needs `TTFT_MS` to produce the first token). See `lib/api.ts`.
- The shell only answers to `localhost` by default; `compose.load.yaml` adds the host `shell` so k6 can use the compose name.
- Not part of CI: a run needs the whole stack and takes minutes. Run it by hand before and after changes to the streaming path.
