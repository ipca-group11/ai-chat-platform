---
title: "AICHAT-14 · [Foundations] Chaos testing"
---

# AICHAT-14 · [Foundations] Chaos testing

| Field | Value |
|---|---|
| Jira | [AICHAT-14](https://ipca-grupo11.atlassian.net/browse/AICHAT-14) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Depends on | AICHAT-144 (mock LLM + env-configurable provider base URL) |
| Related | AICHAT-9 (SSE reconnection), AICHAT-15 (stop during a hang), AICHAT-24 (load testing) |
| Layer | Infrastructure: compose stack (Postgres, services, LLM link) |

## 1. Goal

Inject the three faults named in the epic (**Postgres down**, **slow LLM**, **network drop**) and prove the platform returns
**clear errors**, **does not crash**, and **recovers after the fault ends** without manual restarts. Runs as a **scheduled job**,
not a merge gate.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** toxiproxy in a `chaos` compose profile + `docker stop/start`; Playwright/curl probes
- [ ] Target environment available (local compose; GitHub runner for the schedule)
- [ ] **toxiproxy or Docker scripts available** → to build in US1
- [ ] **Expected degradation per fault defined** → draft in §4.3, agreed in US1

**DoD**
- [ ] Runs as a scheduled job (or documented manual run) and passes on `main`
- [ ] Run instructions added to the project README or `docs/`
- [ ] Postgres down, slow LLM and network drop each tested
- [ ] Clear errors, no crash, recovery after the fault ends
- [ ] Scheduled job, not a merge gate

## 3. Technologies

| Tool | Version | Role |
|---|---|---|
| toxiproxy (`ghcr.io/shopify/toxiproxy`) | latest | TCP proxy with toxics: `latency`, `timeout`, `reset_peer`, `bandwidth`, down |
| Docker Compose profiles | — | Start toxiproxy only for chaos runs |
| curl / Playwright | `1.63.0` | Probes: API status codes, UI messages, time to recover |
| Prometheus + Grafana | in `observability/` | Error rate and latency evidence during a run |
| GitHub Actions `schedule` | — | Nightly/weekly run |

## 4. Discovery: current state

### 4.1 Stack (`compose.yaml`)

`postgres`, `auth-service`, `conversation-service`, `mfe-auth`, `mfe-chat`, `mfe-settings`, `shell`, `prometheus`, `grafana`,
`loki`, `alloy` on network `llm-chat`. **No toxiproxy, no chaos scripts.**

### 4.2 Relevant behaviour found in code

| Area | Finding |
|---|---|
| Health checks | `/health` in **both** services returns `{status:"ok"}` **without checking the database** |
| LLM calls | `llm-adapters/{openai,anthropic}.provider.ts` call `fetch` with the queue's abort signal only: **no timeout anywhere** in conversation-service, so a hung provider can block a chat's queue until the user presses Stop |
| Queue | Provider errors become a `failed` message; failures never stop the queue (AC-74) |
| Auth | conversation-service verifies JWTs locally (`authMiddleware(env.JWT_SECRET)`), so it should keep working while auth-service is down |
| Provider URL | Adapters use the providers' public URLs; routing through toxiproxy needs the env-configurable base URL from AICHAT-144 |

### 4.3 Draft expected degradation (to agree in US1)

| Fault | Expected |
|---|---|
| Postgres down | API 5xx with error envelope, no stack trace; processes stay up; first request after recovery succeeds within N s |
| LLM latency / hang | Reply marked failed after a timeout with a readable error; next queued message runs; Stop works |
| LLM `reset_peer` mid-stream | Reply marked failed (not stuck streaming); partial text policy agreed |
| auth-service down | Login/register show an error; existing sessions keep chatting |

## 5. Implementation plan (steps)

1. `compose.chaos.yaml` (or profile) adding toxiproxy with proxies `postgres` and `llm`; services point at the proxy only in
   this profile. Scripts in `testing/chaos/` (`toxic add/remove`, `down/up`, probe helpers).
2. One script per experiment: apply fault → probe → remove → probe recovery; write a JSON result line.
3. Postgres: idle + mid-request; record `/health` behaviour (and raise a readiness check as a follow-up if wanted).
4. LLM: latency 30 s, timeout toxic, `reset_peer` mid-stream; if no timeout exists, raise it as a defect.
5. auth-service stopped; verify chat still works with an existing session.
6. `.github/workflows/chaos.yml` on `schedule` + `workflow_dispatch`; upload summary + Grafana screenshots.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-194](https://ipca-grupo11.atlassian.net/browse/AICHAT-194) | AICHAT-14-US1 | As a tester, I want a repeatable way to inject faults | `chaos` profile with toxiproxy (Postgres + LLM); toxic scripts; expected degradation agreed | 3 |
| [AICHAT-195](https://ipca-grupo11.atlassian.net/browse/AICHAT-195) | AICHAT-14-US2 | As a user, I want a clear error when the DB is down and automatic recovery | Idle + mid-request; 5xx envelope, no crash/leak; `/health` recorded; recovery without restart, timed | 3 |
| [AICHAT-196](https://ipca-grupo11.atlassian.net/browse/AICHAT-196) | AICHAT-14-US3 | As a user, I want a slow or stuck model to fail clearly | Latency + timeout toxics; failed after timeout; queue continues; Stop works; missing timeout raised | 3 |
| [AICHAT-197](https://ipca-grupo11.atlassian.net/browse/AICHAT-197) | AICHAT-14-US4 | As a user, I want partial network failures to degrade gracefully | `reset_peer` mid-stream → failed; auth-service down → login error, sessions still work; recovery checked | 3 |
| [AICHAT-198](https://ipca-grupo11.atlassian.net/browse/AICHAT-198) | AICHAT-14-US5 | As a team, I want chaos runs scheduled with a report | `chaos.yml` cron + dispatch, not a gate; summary artifact; Grafana evidence | 2 |
| | | **Total** | | **14** |

## 7. Risks and open decisions

- Needs the env-configurable LLM base URL (AICHAT-144); without it only Postgres and auth faults can be injected.
- Adding a provider timeout is an app change; agree the value (first byte vs total) with the conversation-service owner.
- GitHub runners have limited resources; keep the experiment set small and sequential.

## 8. Notes for the report

Reading the code for this epic showed two resilience gaps before any experiment ran: health endpoints that report healthy even
with the database down, and no timeout on LLM calls, so a hung provider can block a chat's queue. The chaos harness turns these
into measured results and checks the platform recovers by itself once each fault is removed.
