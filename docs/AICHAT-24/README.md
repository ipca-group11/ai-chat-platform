---
title: "AICHAT-24 · [Foundations] Load testing"
---

# AICHAT-24 · [Foundations] Load testing

| Field | Value |
|---|---|
| Jira | [AICHAT-24](https://ipca-grupo11.atlassian.net/browse/AICHAT-24) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO (TEST-TYPES marks it 🟡: a script exists but is broken) |
| Depends on | **AICHAT-144 (mock server)**: env-configurable base URLs (AICHAT-43) and the mock LLM (AICHAT-60) moved there |
| Related | AICHAT-25 (fixtures reused by the mock LLM), AICHAT-13 (concurrency) |
| Run mode | **Manual run** (per DoD), not a merge gate |

## 1. Goal

Find the **saturation point of the production VM** (Azure `Standard_B2als_v2`: 2 vCPU, 4 GB RAM + 4 GB swap):
how many concurrent users and SSE streams it handles before p95 latency or errors go over the limits, and how much memory
each container uses at that point. Use a **mock LLM** so tests cost nothing.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** User and stream scenarios on a VM identical to production (`Standard_B2als_v2`) confirmed in scope
- [ ] **Tooling agreed:** k6 (xk6-sse or TTFB measurement), mock LLM, `docker stats` sampling and Grafana confirmed
- [ ] Target environment available (the VM, or a VM of the same size)
- [ ] `testing/k6` scenarios for users and streams → **exists but broken (§4.1)**
- [ ] Mock LLM so it costs nothing → **does not exist (§4.2)**

**DoD**
- [ ] Manual run documented in README/`docs/`
- [ ] Saturation point on the 4 GB VM found and written down (users, streams, p95, memory)

## 3. Technologies

| Tool | Role |
|---|---|
| **k6** (Grafana k6, Go binary or `grafana/k6` image) | Load generator; scenarios, thresholds, custom metrics (`Trend`, `Rate`) |
| **xk6-sse** or k6 `http` with response body streaming | k6's built-in HTTP client waits for the whole response; to measure time to first token on SSE, use the `k6/x/sse` extension (built with `xk6`) or measure `timings.waiting` (TTFB) |
| **Mock LLM server** (to build: small Node/Express or Go service) | Speaks the Anthropic `/v1/messages` and OpenAI `/v1/chat/completions` SSE formats with configurable latency, tokens/s and error rate; can replay the AICHAT-25 recorded fixtures |
| Prometheus + Grafana (already deployed) | Server-side view: `http_request_duration_seconds` p95 per route, `active_streams` gauge, process memory |
| cAdvisor or `docker stats` | Memory/CPU per container during the run (cAdvisor is not deployed today; `docker stats --no-stream` loop is the zero-install option) |
| k6 → Prometheus remote write (optional) | Puts k6 metrics on the same Grafana dashboard as the server metrics |

## 4. Discovery: current state

### 4.1 Existing script `testing/k6/streaming-load.ts` does not match the API
- Default `K6_BASE_URL` is `http://localhost:3001`, which is the **mfe-auth static server**, not auth-service (`:4001`, or `/auth` behind the shell `:8000`).
- `createChat` posts a **`null` body**, but `createChatSchema` requires `title`, `provider` and `model`, so it gets a 400.
- It reads `res.json("id")`, but the API returns `{ chat: { id } }`.
- `sendAndStream` POSTs `/messages` and expects a **200 SSE** response. The real route returns **201 JSON**; the stream is on **`GET /chats/:chatId/stream`**.
- No `X-Llm-Api-Key` header is sent, so the provider fails with "Missing API key".
- Only one scenario (`per-vu-iterations`, 5 VUs). No ramping, so it can't find a saturation point.
- `streaming-load.spec.ts` only checks the script text with Vitest (VU count, thresholds), so these bugs pass CI.

### 4.2 Mock LLM: missing, and the base URL can't be changed
- No mock LLM server exists.
- Both adapters accept `{ baseUrl, fetchImpl }` (`anthropic.provider.ts:71-88`, `openai.provider.ts:8-24`), but `createProviderRegistry()` (`registry.ts:15-19`) constructs them **with no config**, and `env.ts` has no `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL`. **Pointing the service at a mock requires a small code change** (read two env vars in the registry). This is the main blocker.
- Ollama was removed (provider enum is `openai | anthropic`), so it's no longer an option as a free local LLM.

### 4.3 Target environment
- VM: `Standard_B2als_v2` (burstable; CPU credits can run out during long tests, so record the credit balance).
- `deploy/azure/docker-compose.yml` runs ~14 containers (Postgres, 2 services, 4 frontends, Caddy, Prometheus, Grafana, Loki, Alloy, …) with **no memory limits**, so one container can starve the others.
- Request path in production: Caddy → shell (`vite preview`) proxy → services. **The `vite preview` proxy is in the hot path of every API call and SSE stream**, which is a likely bottleneck to measure.

## 5. Implementation plan (steps)

1. **Unblock (delivered by AICHAT-144):** read `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` from env in `createProviderRegistry()`.
2. **Mock LLM (delivered by AICHAT-144, profile `llm`):** `testing/mock-server` LLM routes with `POST /v1/messages` and `POST /v1/chat/completions` → SSE with env-tunable `TTFT_MS`, `TOKENS`, `TOKEN_INTERVAL_MS`, `ERROR_RATE`. Dockerfile + compose override `compose.loadtest.yaml` that adds `mock-llm` and sets the base URLs.
3. **Fix the k6 script** to the real API: register/login on auth-service, `POST /chats {title, provider:"anthropic", model}`, open `GET /chats/:id/stream`, `POST /chats/:id/messages` with `X-Llm-Api-Key: dummy`, wait for `done`.
4. **Scenarios:**
   - `smoke`: 1 VU, 1 iteration (script sanity).
   - `users_ramp`: `ramping-vus` 0 → 200 browsing users (list chats, open chat), to find the REST limit.
   - `streams_ramp`: `ramping-arrival-rate` of new streams/s, each holding an SSE connection for N seconds, to find the concurrent-stream limit.
   - `soak`: chosen level for 30 min, to find memory leaks.
5. **Thresholds** that mark saturation: `http_req_duration{p(95)} < 1000ms` (REST), `time_to_first_token p(95) < 1500ms`, `http_req_failed < 1%`, `stream_success_rate > 99%`.
6. **Observe:** run `docker stats` sampling to CSV during the test; Grafana panels for p95 per route, `active_streams` and process RSS.
7. **Run on the VM** (or an identical VM, to avoid disturbing production) from a separate machine; increase load until a threshold breaks.
8. **Write down the result** in `docs/AICHAT-24/RESULTS.md`: max users, max concurrent streams, p95 at that point, memory per container, bottleneck found (CPU credits? vite preview proxy? Postgres connections? Node event loop?), and recommendations.
9. Fix `streaming-load.spec.ts` to do a smoke run against the mock (or delete the text-matching test).

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-78](https://ipca-grupo11.atlassian.net/browse/AICHAT-78) | AICHAT-24-US3 | As a tester, I want the k6 script to follow the real API so that it measures real behaviour | Smoke scenario passes end-to-end against compose + mock | 3 |
| [AICHAT-96](https://ipca-grupo11.atlassian.net/browse/AICHAT-96) | AICHAT-24-US4 | As a tester, I want ramping user and stream scenarios so that the saturation point can be found | `users_ramp`, `streams_ramp`, `soak` scenarios with saturation thresholds | 3 |
| [AICHAT-114](https://ipca-grupo11.atlassian.net/browse/AICHAT-114) | AICHAT-24-US5 | As an operator, I want container memory/CPU recorded during the run | `docker stats` sampler script and Grafana panels; CSV kept with the results | 2 |
| [AICHAT-128](https://ipca-grupo11.atlassian.net/browse/AICHAT-128) | AICHAT-24-US6 | As the team, I want the saturation point on the 4 GB VM documented | `RESULTS.md` with users, streams, p95, memory, bottleneck, recommendations | 3 |

## 7. Risks and open decisions

- **Testing against production** can affect real users. Use an identical temporary VM or a maintenance window.
- B-series CPU credits make results depend on the credit balance. Record it before and after.
- Measuring time to first token on SSE needs `xk6-sse` (a custom k6 binary) or a TTFB-based approximation. Decide which.
- US1 is a code change in conversation-service and must be agreed.

## 8. Notes for the report

A k6 script exists, but discovery showed it **cannot work against the current API**: wrong service URL, wrong
payloads, POST expected to stream, no API key. Its unit test only checks the script text, so this was not visible. There is
also **no way to point the backend at a mock LLM** without a small configuration change. The plan builds a mock LLM, fixes
the script, adds ramping scenarios to find the saturation point on the 2 vCPU / 4 GB B2als_v2 VM, and records memory per
container. The `vite preview` proxy in the request path and the B-series CPU credits are the likely bottlenecks to check.
