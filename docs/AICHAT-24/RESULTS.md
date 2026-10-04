---
title: "AICHAT-24 · Load testing: results"
---

# AICHAT-24 · Load testing: results

Where the platform saturates on a 4 GB VM, and why. Story [AICHAT-128](https://ipca-grupo11.atlassian.net/browse/AICHAT-128). Date of the runs: 2026-10-03.

## 1. Summary

| Question | Answer |
|---|---|
| Browsing users (list chats, open a chat, 1 to 3 s between pages) | About **400** at the same time. At 400 the REST p95 is 143 to 711 ms; at 475 it is 1.02 s and the 1 s threshold fails. |
| Concurrent streams | About **160** (30 new streams per second, each lasting 5.3 s). Time to first token p95 is 1.31 s at that level and 7.1 s at 40 streams per second. |
| p95 at the limit | REST 484 ms and time to first token 1.31 s with streams (30 per second); REST 143 to 711 ms with browsing users (400). |
| Memory | Not the limit. The containers of the VM peak at **1.1 to 1.3 GB** in total of the 3.6 GB they may use. conversation-service peaks at 192 MiB of 1 GiB. |
| Bottleneck | **CPU of conversation-service** (one Node process, 0.60 core cap, at 100 % from 40 streams per second), with the **shell proxy** (`vite preview`, 0.40 core cap) close behind at 90 %. |
| Soak | 5 minutes at 20 streams per second (about 100 streams open, 3 400 SSE events per second): 5 931 of 5 931 streams done, time to first token p95 922 ms, memory flat. |

These numbers come from a laptop that emulates the VM, with a stand-in for the model. Read section 2 before quoting them.

## 2. What was measured, and how far to trust it

- **It emulates the VM, it is not the VM.** There is no production or Azure target (team decision). The stack runs in Docker on a local machine (8 CPUs, 14 GB for Docker) with `compose.load.yaml` on top of `compose.yaml` and `compose.mock.yaml` (profile `llm`). The limits below add up to the 2 vCPU and 4 GB of an Azure `Standard_B2als_v2`. CPU credits of the B series are not modelled.
- **Limits are per container.** A real VM shares its two vCPUs between all processes, so conversation-service could use a full core when the others are idle. Here it is held at 0.60. The saturation figures are therefore a floor: expect the VM to do somewhat better on CPU-bound work, and check it with one run on the real machine before relying on it. In the runs the 12 containers together used at most 1.2 of the 2.0 cores.
- **The model is a mock** (`testing/mock-server`, AICHAT-144). Load never reaches a provider. Its timing is tuned to look like a hosted model (values below), so every stream lasts about 5 seconds and sends 200 SSE events.
- **Runs are short** (5 minutes each, team decision), so slow leaks are not ruled out. The soak scenario takes a duration from `SOAK_DURATION` (30 minutes by default) and was recorded with 5 minutes.
- **One stack, shared accounts.** auth-service allows 300 requests per 15 minutes per address (finding 1 in section 6), so 40 accounts are signed in once and the virtual users share them. Each virtual user has its own chat. Chats pile up between runs, which is why the two users runs differ a little at the same level.
- **Time to first token** is measured from the request that sends the message to the first `token` event, read with `xk6-sse` (`k6/x/sse`), not estimated from time to first byte. The mock adds 600 ms, so the platform's own share is the difference (about 40 to 80 ms when idle).

### Environment and settings

| Item | Value |
|---|---|
| Tools | Node v24.21.0, pnpm 10.4.0, Docker 29.4.0, k6 v2.3.0 with `xk6-sse` v0.2.0 (image `ai-chat-k6-sse`, [evidence](evidence/00-environment.png)) |
| Entry point | `http://shell:3000`, the same path as on the VM: shell (`vite preview`) proxies `/auth` and `/api` |
| Mock LLM | `TTFT_MS=600`, `TOKEN_INTERVAL_MS=20` (50 tokens per second), `TOKENS=200` (one stream lasts 4.6 s plus the platform), `ERROR_RATE=0`, no extra latency |
| Mock server limit | 1 CPU, 256 MB (outside the VM budget) |

Limits of the containers that make up the VM (`compose.load.yaml`):

| Container | CPU (cores) | Memory |
|---|---|---|
| conversation-service | 0.60 | 1024 MB |
| shell | 0.40 | 512 MB |
| postgres | 0.35 | 512 MB |
| auth-service | 0.25 | 384 MB |
| grafana | 0.10 | 384 MB |
| prometheus | 0.05 | 256 MB |
| loki | 0.05 | 256 MB |
| alloy | 0.05 | 192 MB |
| mfe-auth, mfe-chat, mfe-settings | 0.05 each | 64 MB each |
| **Total** | **2.00** | **3 712 MB** (about 0.3 GB is left for the operating system) |

### Thresholds that mark saturation

REST p95 below 1000 ms (`http_req_duration{kind:rest}`), REST failures below 1 %, time to first token p95 below 1500 ms, streams that end with `done` above 99 %. Every level of a ramp has its own copy, so the first level that fails is the saturation point. No threshold aborts a run.

## 3. Results per scenario

Raw output is in [results/](results/): `<scenario>-k6.txt` (console), `<scenario>-summary.json` (k6 summary) and `<scenario>-docker-stats.csv` (sampler, every 5 seconds).

### users_ramp: browsing users

Staircase of 60 seconds per level (10 s ramp, 50 s hold). Two runs: a wide one and one around the knee.

| Virtual users | REST p95 | REST failed | Threshold (1000 ms) |
|---|---|---|---|
| 100 | 16 ms | 0 % | pass |
| 200 | 27 ms | 0 % | pass |
| 400 | 143 ms (wide run), 711 ms (refine run) | 0 % | pass |
| 475 | 1.02 s | 0 % | **fail** |
| 550 | 1.49 s | 0 % | fail |
| 625 | 1.82 s | 0 % | fail |
| 700 | 1.10 s (wide run), 2.38 s (refine run) | 0 % | fail |
| 1000 | 2.09 s | 0 % | fail |

Requests keep succeeding past the knee (0 % failed up to 1000 users); they just get slow. At 400 users the stack serves roughly 350 REST requests per second. Evidence: [wide run](evidence/02-users-ramp-thresholds.png), [around the knee](evidence/03-users-ramp-refine-thresholds.png). Files: `users_ramp-*`, `users_ramp_refine-*`.

### streams_ramp: new streams per second

Staircase of 60 seconds per level. Concurrent streams = rate x stream duration (checked against `active_streams` in Prometheus: about 100 open streams at 20 per second, 140 to 180 at 30 per second).

| New streams per second | Concurrent streams | Time to first token p95 | REST p95 | Streams done | Thresholds |
|---|---|---|---|---|---|
| 20 | about 100 | 808 ms | 104 ms | 100 % | pass |
| 30 | about 160 | 1.31 s | 484 ms | 100 % | pass |
| 40 | about 310 | 7.12 s | 3.80 s | 100 % | **fail** |
| 50 | about 670 | 13.2 s | 6.17 s | 98.5 % | fail |
| 60 | about 780 | 10.2 s | 6.22 s | 100 % | fail |

Above 30 per second the work queues up: streams take 7 to 13 s instead of 5 s, so more of them are open at once (up to 576 in `active_streams`), which makes it worse. A first, wider run with levels 20, 30, 45, 60 and 80 gave the same picture (level 30 passes with 1.23 s, level 45 fails with 9.3 s): [results/first-pass](results/first-pass). Evidence: [ramp](evidence/04-streams-ramp-thresholds.png), [thresholds failing past saturation](evidence/07-thresholds-failing-past-saturation.png).

### soak: steady load

20 new streams per second (two thirds of the knee) for 5 minutes.

| Metric | Value |
|---|---|
| Streams | 5 931 started, 5 931 done (100 %) |
| Time to first token | avg 680 ms, p95 922 ms |
| REST p95 | 149 ms |
| SSE events delivered | 1 186 200 (3 400 per second) |
| conversation-service memory | 165 MiB at the start, 178 MiB at the end, peak 186 MiB |
| shell memory | 118 MiB, then 117 MiB |

No leak shows in 5 minutes. conversation-service already uses 0.54 core of its 0.60 at this level, so there is little margin: this is the highest rate worth holding for long. Evidence: [soak summary](evidence/05-soak-summary.png).

### Smoke

One user, one full flow (sign in, create a chat, send a message, read the stream): passes, time to first token 821 ms, stream of 5.15 s ([evidence](evidence/01-smoke-run.png)).

## 4. Memory and CPU (docker stats)

Peak per container during the streams ramp and the soak (from the `*-docker-stats.csv` files; CPU is a share of one core, the limit in cores is in brackets). [Sampler head](evidence/06-sampler-output-head.png), [Grafana panels](evidence/08-grafana-load-test.png) (container, stream and latency panels of a short ramp; the k6 row needs `K6_PROM_RW=1` and had not been drawn when the screenshot was taken, Grafana runs on 0.10 core).

| Container | Peak memory | Share of its limit | Peak CPU | Share of its limit |
|---|---|---|---|---|
| conversation-service | 192 MiB | 19 % | 64 % | **107 %** (0.60) |
| shell | 125 MiB | 24 % | 41 % | **101 %** (0.40) |
| postgres | 119 MiB | 23 % | 31 % | 89 % (0.35) |
| auth-service | 54 MiB (96 MiB while signing in) | 14 % | 26 % | 105 % (0.25), only while hashing passwords at the start |
| grafana | 384 MiB | **100 %** | 12 % | 120 % (0.10) |
| alloy | 152 MiB | 79 % | 7 % | 140 % of 0.05, at start-up |
| loki | 145 MiB | 57 % | 8 % | 160 % of 0.05, at start-up |
| prometheus | 138 MiB | 54 % | 6 % | 120 % of 0.05 |
| mfe-auth, mfe-chat, mfe-settings | 53 to 57 MiB | 83 to 88 % | 3 % | 60 % of 0.05 |
| **All VM containers together** | **1.1 to 1.3 GB** | 31 to 35 % of 3.6 GB | 1.1 to 1.35 cores | of 2.0 |

(The mock server peaked at 109 MiB and 51 % of a core; it is not part of the budget.)

## 5. Bottleneck

1. **conversation-service CPU.** Its CPU line is flat at the 0.60 cap from 40 streams per second (and from 400 browsing users) while the other services are far below theirs. It is one Node event loop; each stream means one SSE write per token (3 400 writes per second at 100 streams) plus a database write per message.
2. **The shell proxy.** `vite preview` is on the path of every API call and every stream and reached its 0.40 cap (41 %), so it would be next. It also holds back the response head of a stream until the first event (see finding 4).
3. **Not memory, not the database, not auth-service.** Postgres stays under 35 % CPU and 120 MiB; auth-service is only busy while hashing passwords (bcrypt on 0.25 core: a sign-in takes about 0.12 s of CPU, so a burst of sign-ins is slow).

## 6. Findings that are not about speed

1. **Sign-in limit shared by everyone.** auth-service rate-limits to 300 requests per 15 minutes per client address and does not set `trust proxy`. Behind Caddy and the shell proxy every user has the same address, so the whole platform is limited to 300 sign-ins, `/auth/me` checks and refreshes per 15 minutes. The load test works around it with shared accounts (it cannot sign in 400 users).
   **Update ([AICHAT-222](https://ipca-grupo11.atlassian.net/browse/AICHAT-222)):** fixed. auth-service now sets `trust proxy` (env `TRUST_PROXY`, default 1 hop for Caddy) and keys the limiter on the resolved client address, so each user has their own 300 requests per 15 minutes. A client cannot reset its budget by sending its own `X-Forwarded-For`, because only the entry Caddy appends is trusted (`services/auth-service/src/integration/rate-limit.spec.ts`). Without Caddy in front (local `compose.yaml`), all users still share one address.
2. **Monitoring does not fit its limits.** Grafana reaches 100 % of 384 MB and is throttled to its 0.10 core; alloy and loki exceed their CPU caps at start-up. Those limits are the sum of what fits in 4 GB with the services, not a recommendation for Grafana.
3. **The deploy compose file has no limits** (`deploy/azure/docker-compose.yml`), so one container can use the whole VM. Here it is bounded.
4. **Stream head is held back.** The shell proxy sends no response headers for `GET /chats/:id/stream` until the first event, so a client waiting for the stream to open (xk6-sse, and any `EventSource` `open` handler) waits until a message is sent. Directly on conversation-service the head arrives in 15 ms. The load test sends the message first and opens the stream right after.

## 7. Recommendations

1. **Plan for 30 new streams per second (about 150 open streams) and 400 browsing users per VM** on this stack, and treat 20 streams per second as the sustained level. This fits a classroom or a small team; it does not fit a public launch.
2. **Get conversation-service off the critical path first.** Batch tokens into one SSE write every 30 to 50 ms instead of one write per token (the client does not need 50 writes per second), and run a second instance of the service (or `cluster`) so that more than one core is used. Expect the largest gain here.
3. **Serve the proxy path from Caddy, not from `vite preview`.** Let Caddy route `/api` and `/auth` straight to the services and serve the built MFEs as static files. That removes the second candidate for the bottleneck and the held-back stream head.
4. **Set `trust proxy` in auth-service and make the sign-in limit configurable** (per user or per address behind the proxy). Without this the limit of finding 1 is reached with a few dozen users on one day.
5. **Add CPU and memory limits to the Azure compose file**, using `compose.load.yaml` as the starting point, and give Grafana 512 MB.
6. **Run once on the real VM** before a release that raises the target: the CPU credits of the B series are not part of these numbers, and the shared-core behaviour should improve them. Use `bash testing/k6/run.sh streams_ramp` against the VM address with `BASE_URL`.
7. **Run a 30-minute soak** (`SOAK_DURATION=30m`) at 20 streams per second before a demo; the recorded 5 minutes show no leak but cannot show a slow one.
8. **Add a mixed scenario** (browsing users and streams together) when the capacity target is set; the two limits above were measured one at a time and will be lower together.

## 8. How to repeat it

```sh
pnpm load:up                                  # stack with the VM limits and the LLM mock
bash testing/k6/run.sh seed                   # once: 40 accounts (then restart auth-service to reset its limit)
bash testing/k6/run.sh smoke
K6_PROM_RW=1 bash testing/k6/run.sh users_ramp
K6_PROM_RW=1 bash testing/k6/run.sh streams_ramp
SOAK_DURATION=5m K6_PROM_RW=1 bash testing/k6/run.sh soak
pnpm mock:down
```

Details and every variable: [testing/k6/README.md](../../testing/k6/README.md). Grafana dashboard "Load test (AICHAT-24)" is provisioned with the stack; the container panels are fed by the sampler (`scripts/load/docker-stats-sampler.ts`, started by `run.sh`) and the k6 panels by `K6_PROM_RW=1`.
