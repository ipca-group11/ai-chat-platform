---
name: aichat-144-mock-server
description: Run epic AICHAT-144 (Mock server) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-144", "work on AICHAT-144", "continue AICHAT-144".
---

# AICHAT-144 · [Foundations] Mock server

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-144. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-144 · [Foundations] Mock server |
| Branch | `test/AICHAT-144-mock-server` |
| Work log | `docs/AICHAT-144/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-144/evidence/` |
| Layer | Test infrastructure: every dependency of the platform (LLM providers, backend APIs, MFE remotes, telemetry collector) |
| Related | AICHAT-24 (load testing), AICHAT-25 (recorded LLM fixtures), AICHAT-26 (prompt injection), AICHAT-28 (DAST), AICHAT-18/19/21 (frontend tests against a mocked backend), AICHAT-32 (PII in telemetry) |

## Goal

One **mock server** (`testing/mock-server`) that can stand in for **every dependency** of the platform:

- the **LLM providers** (Anthropic Messages API and OpenAI Chat Completions API, with SSE streaming, thinking, web fetch, stop reasons and errors);
- our own **backend APIs** (auth-service and conversation-service, including the chat SSE stream), so the shell and the MFEs run and are tested **without Postgres or the services**;
- the **MFE remotes** (slow, broken or missing `remoteEntry.js`), to test the shell's fallback;
- the **telemetry collector** (Grafana Faro `/collect`), to capture what the browser sends.

The backend mocks serve **mock data**: named seed datasets (empty, default, many chats, long conversation, shared chats,
attachments) built from shared data factories, so every test starts from known, realistic data.

Every mock supports **scenarios and fault injection** on demand and records the requests it receives, so tests are
**deterministic, free, fast and independent** of real API keys and of the rest of the stack.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-144/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-144/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-144/README.md` |
| Mocks and scenarios (proposal, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-144/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-144/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: LLM providers, auth-service and conversation-service APIs, MFE remotes and telemetry sink (§5) confirmed in scope
2. Tooling agreed: Node + Express in an Nx project `testing/mock-server` (one process, one router per mock), Docker image, compose profiles
3. Small app change agreed: `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` read in `createProviderRegistry()` (defaults unchanged)
4. Target environment available (local, CI)

The proposal to put in front of the owner is in README "Mocks and scenarios (proposal, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - **App change needed** (LLM base URLs from env): small, default behaviour unchanged, but must be agreed with the conversation-service owner.
  - **Drift:** providers add event types and our services change their API; contract tests (US14) plus periodic re-recording (AICHAT-25) keep the mocks honest.
  - **Backend mock scope:** full in-memory behaviour of conversation-service is the biggest story; agree which flows must be stateful (send/stream/edit) and which can be canned.
  - **Scenario selection** must never reach production; the mocks are wired in only through compose profiles and CI.
  - Location: `testing/mock-server` (new top-level folder) or `tools/mock-server`; agree with the team.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-43 | Make LLM provider base URLs configurable by env | 2 | `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` read by the registry; defaults unchanged; unit test |
| AICHAT-60 | Mock server project, admin endpoints and Docker image | 3 | `testing/mock-server` Nx project; one router per mock; `/__admin/health`, `/__admin/scenarios`, `/__admin/reset`; Dockerfile; `LATENCY_MS`, `TTFT_MS`, `TOKEN_INTERVAL_MS`, `TOKENS`, `ERROR_RATE`, `SEED` env |
| AICHAT-145 | LLM mock: Anthropic Messages API streaming | 5 | `POST /anthropic/v1/messages` full event sequence; `thinking` and `web_fetch` blocks; stop reasons `end_turn`, `max_tokens`, `pause_turn`; non-stream JSON response |
| AICHAT-146 | LLM mock: OpenAI Chat Completions streaming | 3 | `POST /openai/v1/chat/completions` chunk stream with `finish_reason` and `[DONE]`; `length` stop |
| AICHAT-147 | LLM mock: per-request scenario selection | 3 | Scenario via model suffix or `X-Mock-Scenario` header; scenarios listed by `/__admin/scenarios`; same `SEED` gives the same answer |
| AICHAT-148 | LLM mock: provider errors and broken streams | 3 | 401, 429 (with `retry-after`), 500, 529 bodies match the providers; `drop` closes mid-stream; `slow` delays the first token |
| AICHAT-149 | LLM mock: replay recorded provider streams | 2 | `replay:<fixture>` serves AICHAT-25 fixtures byte for byte; missing fixture returns a clear 404 |
| AICHAT-155 | auth-service API mock | 3 | `/auth/register`, `/login`, `/logout`, `/me` with session cookie; seeded users; validation errors shaped like the real service |
| AICHAT-156 | conversation-service API mock (incl. chat SSE stream) | 5 | Chats, members, messages (send, edit, cancel, retry), chat SSE stream, attachments and provider-key settings with in-memory state and seed data; streamed answers reuse the LLM scenarios |
| AICHAT-157 | Fault injection for the backend mocks | 3 | `session-expired`, `error-500`, `slow`, `stream-drop` via `X-Mock-Scenario` or `POST /__admin/faults` (per route, cleared by reset) |
| AICHAT-158 | MFE remote mock: slow, missing and broken remotes | 2 | `/remotes/<name>/remoteEntry.js` with `ok`, `slow`, `404`, `broken-js`; shell `RemoteFallback` shown in a test |
| AICHAT-159 | Telemetry sink for Faro payloads | 2 | `POST /collect` stores payloads; `GET /__admin/requests?mock=collect` returns them |
| AICHAT-150 | Request inspection across all mocks | 2 | `GET /__admin/requests` (filter by mock) with API keys, tokens and cookies masked; cleared by `/__admin/reset` |
| AICHAT-151 | Contract tests for the mocks | 3 | Real LLM adapters parse every LLM scenario; backend mock responses validated against `@platform/shared-types` schemas; drift fails CI |
| AICHAT-152 | Compose profiles and one-command start with the mocks | 3 | Compose profiles `llm` (real stack + LLM mock) and `frontend-only` (shell + MFEs + backend mock); `pnpm mock:up` / `mock:down` / `dev:mock` |
| AICHAT-153 | E2E chat flows in CI against the mock | 3 | `e2e.yml` uses the `llm` profile; send, stream, cancel, retry and provider-error flows pass; no real key in CI |
| AICHAT-154 | Mock server usage guide for the other testing epics | 1 | Mock and scenario tables, env variables, run commands and examples for AICHAT-18/19/21/24/26/28/32 in `docs/AICHAT-144/` |
| AICHAT-160 | Mock data: named seed datasets and data factories | 3 | Factories for users, chats, members, messages (incl. thinking / web fetch parts), attachments and provider keys built on `@platform/shared-types`; datasets `empty`, `default`, `many-chats` (200+), `long-conversation` (500 messages), `shared-chats` (several members), `attachments`; loaded with `POST /__admin/seed/<dataset>` or `MOCK_DATASET` env; same factories usable from Vitest and Playwright |

Parallel plan: AICHAT-43 (base URLs) and AICHAT-60 (scaffold) first, in sequence; then AICHAT-160 (mock data) because the backend mocks load datasets. Then three independent tracks, one agent each with `isolation: "worktree"`: **LLM** (AICHAT-145 → 146 → 147 → 148 → 149), **backend** (AICHAT-155 → 156 → 157), **edge mocks** (AICHAT-158, 159, 150). Then AICHAT-151 (contract tests), AICHAT-152 (compose profiles), AICHAT-153 (E2E in CI), AICHAT-154 (guide). Give each track agent only the §5 table rows for its mocks and its stories' acceptance criteria.

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Mock server runs locally and in CI with one command; health check green
- [ ] Both LLM adapters stream a full answer from the mock (contract tests pass)
- [ ] Shell + MFEs work end to end against the backend mock (`frontend-only` profile) with every named dataset
- [ ] Backend mock responses validated against the `@platform/shared-types` schemas (no drift from the real services)
- [ ] Fault scenarios (provider errors, session expiry, 500, slow responses, dropped streams, broken remote) reproducible on demand
- [ ] E2E chat flows run in CI against the mock, no real key used
- [ ] Run instructions and scenario list documented
