---
title: "AICHAT-144 · [Foundations] Mock server"
---

# AICHAT-144 · [Foundations] Mock server

| Field | Value |
|---|---|
| Jira | [AICHAT-144](https://ipca-grupo11.atlassian.net/browse/AICHAT-144) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-24 (load testing), AICHAT-25 (recorded LLM fixtures), AICHAT-26 (prompt injection), AICHAT-28 (DAST), AICHAT-18/19/21 (frontend tests against a mocked backend), AICHAT-32 (PII in telemetry) |
| Layer | Test infrastructure: every dependency of the platform (LLM providers, backend APIs, MFE remotes, telemetry collector) |

## 1. Goal

One **mock server** (`testing/mock-server`) that can stand in for **every dependency** of the platform:

- the **LLM providers** (Anthropic Messages API and OpenAI Chat Completions API, with SSE streaming, thinking, web fetch, stop reasons and errors);
- our own **backend APIs** (auth-service and conversation-service, including the chat SSE stream), so the shell and the MFEs run and are tested **without Postgres or the services**;
- the **MFE remotes** (slow, broken or missing `remoteEntry.js`), to test the shell's fallback;
- the **telemetry collector** (Grafana Faro `/collect`), to capture what the browser sends.

The backend mocks serve **mock data**: named seed datasets (empty, default, many chats, long conversation, shared chats,
attachments) built from shared data factories, so every test starts from known, realistic data.

Every mock supports **scenarios and fault injection** on demand and records the requests it receives, so tests are
**deterministic, free, fast and independent** of real API keys and of the rest of the stack.

## 2. Definition of Ready / Done

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** LLM providers, auth-service and conversation-service APIs, MFE remotes and telemetry sink (§5) confirmed in scope
- [ ] **Tooling agreed:** Node + Express in an Nx project `testing/mock-server` (one process, one router per mock), Docker image, compose profiles
- [ ] Small app change agreed: `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` read in `createProviderRegistry()` (defaults unchanged)
- [ ] Target environment available (local, CI)

**DoD**
- [ ] Mock server runs locally and in CI with one command; health check green
- [ ] Both LLM adapters stream a full answer from the mock (contract tests pass)
- [ ] Shell + MFEs work end to end against the backend mock (`frontend-only` profile) with every named dataset
- [ ] Backend mock responses validated against the `@platform/shared-types` schemas (no drift from the real services)
- [ ] Fault scenarios (provider errors, session expiry, 500, slow responses, dropped streams, broken remote) reproducible on demand
- [ ] E2E chat flows run in CI against the mock, no real key used
- [ ] Run instructions and scenario list documented

## 3. Technologies

| Tool | Role |
|---|---|
| Node 24 + Express | One server, one router per mock (`/anthropic`, `/openai`, `/auth`, `/api`, `/remotes`, `/collect`, `/__admin`); SSE via `res.write` |
| `@platform/shared-types` (Zod) | Request/response schemas of the real services; the backend mock validates against them |
| Vitest + supertest | Unit tests of the mock server |
| Existing LLM adapters | Contract tests: the real parsers consume the LLM mock's output |
| Docker / compose profiles | `llm` (real stack + LLM mock) and `frontend-only` (shell + MFEs + backend mock) |
| Recorded SSE fixtures (AICHAT-25) | Replayed byte for byte by scenario name |
| Playwright (existing `e2e`) | Chat flows in CI against the mock |

Alternatives considered: **MSW** works inside the browser/Vitest only (no shared server for k6, ZAP or compose);
**WireMock / Prism** are OpenAPI-driven and good for JSON, but weak for timed SSE streams and provider-specific event
sequences. A small purpose-built server is easier to control, reuse across epics and explain. MSW stays an option for
unit tests (AICHAT-17 spike) and can reuse the same fixtures.

## 4. Discovery: current state

- **No mock of any kind exists.** E2E (`.github/workflows/e2e.yml`) starts the full compose stack with no provider
  key, so a real streamed answer can't be exercised in CI; load (AICHAT-24) and prompt-injection (AICHAT-26) tests
  would need paid API calls; frontend tests need the whole backend running.
- **LLM base URL is hard-coded.** Both adapters accept `{ baseUrl, fetchImpl }`
  (`services/conversation-service/src/features/llm-adapters/anthropic.provider.ts`, `openai.provider.ts`), but
  `createProviderRegistry()` (`registry.ts`) builds them with no config, and `shared/env.ts` has no base URL variables.
- **Backend URLs are already configurable.** The shell proxies `/auth` and `/api` to `AUTH_SERVICE_URL` and
  `CONVERSATION_SERVICE_URL` (`apps/shell/vite.config.ts`), so the frontends can be pointed at a mock **without code changes**.
- **Remote URLs are configurable.** `VITE_MFE_AUTH_URL`, `VITE_MFE_CHAT_URL`, `VITE_MFE_SETTINGS_URL` (`apps/shell/.env.local.example`).
- **Telemetry:** the browser sends Faro payloads to `/collect` (Alloy); there is no way to capture them in a test.
- **Streaming parser:** `http-stream.ts` reads SSE `data:` lines and stops at `[DONE]`; the Anthropic adapter handles
  `thinking`, the `web_fetch` server tool and `pause_turn`. The LLM mock must emit exactly these shapes.

## 5. Mocks and scenarios (proposal, DoR)

| Mock | Routes | Scenarios |
|---|---|---|
| **LLM: Anthropic** | `POST /anthropic/v1/messages` | `ok`, `long`, `thinking`, `web-fetch`, `pause-turn`, `max-tokens`, `error-401/429/500/529`, `drop`, `slow`, `replay:<fixture>` |
| **LLM: OpenAI** | `POST /openai/v1/chat/completions` | `ok`, `long`, `max-tokens` (`finish_reason: length`), errors, `drop`, `slow`, `replay:<fixture>` |
| **auth-service** | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` | seeded users; `session-expired` (401 on next call), `error-500`, `slow` |
| **conversation-service** | `/api/chats`, members, messages (send, edit, cancel, retry), `GET /api/chats/:id/stream` (SSE), attachments, provider-key settings | in-memory state with seed data; streamed answers reuse the LLM mock scenarios; `error-500`, `slow`, `stream-drop` |
| **MFE remotes** | `/remotes/<name>/remoteEntry.js` | `ok` (proxy to the real build), `slow`, `404`, `broken-js` |
| **Telemetry sink** | `POST /collect` | captures Faro payloads for inspection |
| **Mock data** | `POST /__admin/seed/<dataset>`, `MOCK_DATASET` env | `empty`, `default`, `many-chats`, `long-conversation`, `shared-chats`, `attachments` |
| **Admin** | `/__admin/health`, `/__admin/scenarios`, `/__admin/requests`, `/__admin/reset`, `/__admin/faults` | — |

Scenario selection: `X-Mock-Scenario` header, model name suffix (LLM), or a fault set with `POST /__admin/faults`
(for browser tests that can't add headers). Env tuning: `TTFT_MS`, `TOKEN_INTERVAL_MS`, `TOKENS`, `LATENCY_MS`, `ERROR_RATE`, `SEED`.

## 6. Implementation plan (steps)

1. **Unblock:** read `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` in `env.ts` and pass them in `createProviderRegistry()`; defaults stay the real APIs; unit test.
2. **Scaffold** `testing/mock-server` (Nx project, Express, router per mock, admin endpoints, Dockerfile, env tuning, `SEED`).
3. **LLM mocks:** Anthropic event sequence (`message_start`, `content_block_*`, `message_delta`, `message_stop`, thinking, web fetch, stop reasons); OpenAI chunk stream with `[DONE]`; scenarios, errors, dropped streams, fixture replay.
4. **Mock data:** factories on `@platform/shared-types` and named datasets, shared with Vitest and Playwright.
5. **Backend mocks:** auth-service and conversation-service routes with in-memory state loaded from a dataset; chat SSE stream; responses built from `@platform/shared-types`.
6. **Fault injection** for the backend mocks (session expiry, 500, slow, stream drop) via header or `/__admin/faults`.
7. **MFE remote mock** (slow / 404 / broken JS) and **telemetry sink** (`/collect` capture).
8. **Request log** across all mocks (`/__admin/requests`, secrets masked), `/__admin/reset`.
9. **Contract tests:** real LLM adapters against the LLM mock; backend mock responses validated against the shared-types schemas; a schema change without a mock update fails CI.
10. **Compose profiles:** `llm` and `frontend-only`, plus `pnpm mock:up` / `mock:down` / `dev:mock`.
11. **CI:** E2E workflow runs the chat flows (send, stream, cancel, retry, provider error) against the mock.
12. **Docs:** scenario table, how to run, how AICHAT-18/19/21/24/26/28/32 use it.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-43](https://ipca-grupo11.atlassian.net/browse/AICHAT-43) | AICHAT-144-US1 | As a tester, I want the LLM provider base URLs configurable by env so that the backend can talk to the mock | `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` read by the registry; defaults unchanged; unit test | 2 |
| [AICHAT-60](https://ipca-grupo11.atlassian.net/browse/AICHAT-60) | AICHAT-144-US2 | As a tester, I want one mock server project with a Docker image, admin endpoints and latency tuning so that every mock runs from the same place | `testing/mock-server` Nx project; one router per mock; `/__admin/health`, `/__admin/scenarios`, `/__admin/reset`; Dockerfile; `LATENCY_MS`, `TTFT_MS`, `TOKEN_INTERVAL_MS`, `TOKENS`, `ERROR_RATE`, `SEED` env | 3 |
| [AICHAT-145](https://ipca-grupo11.atlassian.net/browse/AICHAT-145) | AICHAT-144-US3 | As a tester, I want the mock to stream like the Anthropic Messages API so that the Anthropic adapter is exercised for real | `POST /anthropic/v1/messages` full event sequence; `thinking` and `web_fetch` blocks; stop reasons `end_turn`, `max_tokens`, `pause_turn`; non-stream JSON response | 5 |
| [AICHAT-146](https://ipca-grupo11.atlassian.net/browse/AICHAT-146) | AICHAT-144-US4 | As a tester, I want the mock to stream like the OpenAI Chat Completions API so that the OpenAI adapter is exercised for real | `POST /openai/v1/chat/completions` chunk stream with `finish_reason` and `[DONE]`; `length` stop | 3 |
| [AICHAT-147](https://ipca-grupo11.atlassian.net/browse/AICHAT-147) | AICHAT-144-US5 | As a tester, I want to pick an LLM scenario per request so that one running mock serves every test | Scenario via model suffix or `X-Mock-Scenario` header; scenarios listed by `/__admin/scenarios`; same `SEED` gives the same answer | 3 |
| [AICHAT-148](https://ipca-grupo11.atlassian.net/browse/AICHAT-148) | AICHAT-144-US6 | As a tester, I want LLM provider errors and broken streams on demand so that error handling is tested | 401, 429 (with `retry-after`), 500, 529 bodies match the providers; `drop` closes mid-stream; `slow` delays the first token | 3 |
| [AICHAT-149](https://ipca-grupo11.atlassian.net/browse/AICHAT-149) | AICHAT-144-US7 | As a tester, I want recorded provider streams replayed by the mock so that tests use real-world payloads | `replay:<fixture>` serves AICHAT-25 fixtures byte for byte; missing fixture returns a clear 404 | 2 |
| [AICHAT-155](https://ipca-grupo11.atlassian.net/browse/AICHAT-155) | AICHAT-144-US8 | As a frontend developer, I want an auth-service mock so that the shell and mfe-auth run without the real service and database | `/auth/register`, `/login`, `/logout`, `/me` with session cookie; seeded users; validation errors shaped like the real service | 3 |
| [AICHAT-156](https://ipca-grupo11.atlassian.net/browse/AICHAT-156) | AICHAT-144-US9 | As a frontend developer, I want a conversation-service mock so that mfe-chat and mfe-settings run without the real service and database | Chats, members, messages (send, edit, cancel, retry), chat SSE stream, attachments and provider-key settings with in-memory state and seed data; streamed answers reuse the LLM scenarios | 5 |
| [AICHAT-157](https://ipca-grupo11.atlassian.net/browse/AICHAT-157) | AICHAT-144-US10 | As a tester, I want faults injected into the backend mocks so that frontend error states can be tested | `session-expired`, `error-500`, `slow`, `stream-drop` via `X-Mock-Scenario` or `POST /__admin/faults` (per route, cleared by reset) | 3 |
| [AICHAT-158](https://ipca-grupo11.atlassian.net/browse/AICHAT-158) | AICHAT-144-US11 | As a tester, I want slow, missing and broken MFE remotes on demand so that the shell fallback is tested | `/remotes/<name>/remoteEntry.js` with `ok`, `slow`, `404`, `broken-js`; shell `RemoteFallback` shown in a test | 2 |
| [AICHAT-159](https://ipca-grupo11.atlassian.net/browse/AICHAT-159) | AICHAT-144-US12 | As a tester, I want a telemetry sink that captures Faro payloads so that PII and telemetry tests can inspect what the browser sends | `POST /collect` stores payloads; `GET /__admin/requests?mock=collect` returns them | 2 |
| [AICHAT-150](https://ipca-grupo11.atlassian.net/browse/AICHAT-150) | AICHAT-144-US13 | As a tester, I want to inspect every request the mocks received so that tests can assert what was sent | `GET /__admin/requests` (filter by mock) with API keys, tokens and cookies masked; cleared by `/__admin/reset` | 2 |
| [AICHAT-151](https://ipca-grupo11.atlassian.net/browse/AICHAT-151) | AICHAT-144-US14 | As a developer, I want contract tests for the mocks so that they can't drift from the real adapters and services | Real LLM adapters parse every LLM scenario; backend mock responses validated against `@platform/shared-types` schemas; drift fails CI | 3 |
| [AICHAT-152](https://ipca-grupo11.atlassian.net/browse/AICHAT-152) | AICHAT-144-US15 | As a developer, I want one command to start the stack with the mocks so that local runs need no API key and no backend | Compose profiles `llm` (real stack + LLM mock) and `frontend-only` (shell + MFEs + backend mock); `pnpm mock:up` / `mock:down` / `dev:mock` | 3 |
| [AICHAT-153](https://ipca-grupo11.atlassian.net/browse/AICHAT-153) | AICHAT-144-US16 | As a team, I want the E2E chat flows to run in CI against the mock so that sending and streaming are tested on every PR | `e2e.yml` uses the `llm` profile; send, stream, cancel, retry and provider-error flows pass; no real key in CI | 3 |
| [AICHAT-154](https://ipca-grupo11.atlassian.net/browse/AICHAT-154) | AICHAT-144-US17 | As a tester, I want a usage guide for the mock server so that the other testing epics reuse it | Mock and scenario tables, env variables, run commands and examples for AICHAT-18/19/21/24/26/28/32 in `docs/AICHAT-144/` | 1 |
| [AICHAT-160](https://ipca-grupo11.atlassian.net/browse/AICHAT-160) | AICHAT-144-US18 | As a tester, I want named mock datasets and data factories so that every test starts from known, realistic data | Factories for users, chats, members, messages (incl. thinking / web fetch parts), attachments and provider keys built on `@platform/shared-types`; datasets `empty`, `default`, `many-chats` (200+), `long-conversation` (500 messages), `shared-chats` (several members), `attachments`; loaded with `POST /__admin/seed/<dataset>` or `MOCK_DATASET` env; same factories usable from Vitest and Playwright | 3 |

## 8. Risks and open decisions

- **App change needed** (LLM base URLs from env): small, default behaviour unchanged, but must be agreed with the conversation-service owner.
- **Drift:** providers add event types and our services change their API; contract tests (US14) plus periodic re-recording (AICHAT-25) keep the mocks honest.
- **Backend mock scope:** full in-memory behaviour of conversation-service is the biggest story; agree which flows must be stateful (send/stream/edit) and which can be canned.
- **Scenario selection** must never reach production; the mocks are wired in only through compose profiles and CI.
- Location: `testing/mock-server` (new top-level folder) or `tools/mock-server`; agree with the team.

## 9. Notes for the report

Many testing epics need something that is expensive, slow or not deterministic: LLM calls cost money and give different
answers every time, and frontend tests need the whole backend and a database running. The frontends can already be pointed
at other backend URLs, and the LLM adapters can already take a different base URL (the registry just doesn't pass one).
One purpose-built mock server covers all of it: it speaks the Anthropic and OpenAI streaming formats, imitates our own
auth and conversation APIs (including the chat SSE stream), serves broken MFE remotes and captures telemetry, with
scenarios and fault injection on demand. Contract tests against the real adapters and the shared schemas keep the mocks
faithful, and every other testing epic (component, visual, performance, load, DAST, prompt injection, PII) can reuse it.
