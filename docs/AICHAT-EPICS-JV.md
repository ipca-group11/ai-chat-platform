---
title: "João Vieira's testing epics: discovery index"
---

# João Vieira's testing epics: discovery index

Discovery of the 9 Jira epics assigned to João Vieira in [AICHAT](https://ipca-grupo11.atlassian.net/jira/software/projects/AICHAT/list)
(AICHAT-8 to AICHAT-16, label `testing`, all **TODO** on 2026-10-03). JP's epics (AICHAT-17..34, AICHAT-144) are indexed in
[AICHAT-EPICS.md](AICHAT-EPICS.md). Each epic has its own folder `docs/AICHAT-<id>/README.md` with the same sections:

1. Goal · 2. DoR/DoD (from Jira) · 3. Technologies · 4. Discovery: current state (with file references) ·
5. Implementation plan · 6. User stories (with acceptance criteria and story points) · 7. Risks and open decisions · 8. Notes for the report

This is **discovery only**: no application code was changed. The way each epic is worked is described in [EPIC-WORKFLOW.md](EPIC-WORKFLOW.md).

## Overview

| Epic | Title | Layer | Main tools | Stories | Points | Blocked by |
|---|---|---|---|---|---|---|
| [AICHAT-8](AICHAT-8/README.md) | Remote failure and fallback testing | Module Federation (shell + 3 remotes) | Playwright `page.route`, Vitest | 6 | 13 | load-timeout decision |
| [AICHAT-9](AICHAT-9/README.md) | SSE reconnection testing | LLM streaming | fake `EventSource`, supertest, Playwright `setOffline` | 5 | 14 | recovery rule (US1); AICHAT-144 for E2E |
| [AICHAT-10](AICHAT-10/README.md) | Accessibility testing | Frontend | `@axe-core/playwright`, Playwright keyboard, `vitest-axe` (optional) | 5 | 16 | page × theme matrix agreed |
| [AICHAT-11](AICHAT-11/README.md) | Consumer-driven contract testing | MFE ↔ service REST | Pact JS V3, `@platform/pact-config`, Nx | 6 | 20 | pact-sharing decision |
| [AICHAT-12](AICHAT-12/README.md) | API schema validation testing | Backend API | Zod, Zod → OpenAPI, supertest, Schemathesis | 6 | 20 | schema source of truth |
| [AICHAT-13](AICHAT-13/README.md) | Concurrency testing | Per-chat message queue | Vitest deferred promises, supertest, Playwright 2 contexts | 5 | 15 | expected results (US1); AICHAT-144 for E2E |
| [AICHAT-14](AICHAT-14/README.md) | Chaos testing | Infrastructure | toxiproxy, compose profile, scheduled workflow | 5 | 14 | AICHAT-144 base URL for LLM faults |
| [AICHAT-15](AICHAT-15/README.md) | Stream cancellation testing | Stop → queue → provider | Vitest, supertest, mock LLM, Playwright | 6 | 16 | "navigating away" rule; AICHAT-144 |
| [AICHAT-16](AICHAT-16/README.md) | Mutation testing | Test quality | StrykerJS + Vitest runner, scheduled workflow | 5 | 14 | AICHAT-34 (JP) |
| | **Total** | | | **49** | **142** | |

Stories were created in Jira on 2026-10-03 as children of their epic (AICHAT-161 to AICHAT-209), assigned to João Vieira,
label `testing`. Each story has its own Jira key (listed in §6 of every epic README); `AICHAT-<epic>-US<n>` is only the
reference inside the analysis docs.

## Suggested order

1. **Quick wins with a real defect behind them:** AICHAT-15 (Stop button calls a route that does not exist), AICHAT-11 (the
   contract tests that would have caught it).
2. **No external dependency:** AICHAT-8 (remote fallback), AICHAT-10 (accessibility), AICHAT-12 (schema validation).
3. **Needs the mock LLM (JP's AICHAT-144):** AICHAT-9 (E2E part), AICHAT-13 (E2E part), AICHAT-14.
4. **Needs coverage enforcement (JP's AICHAT-34):** AICHAT-16.

## Cross-cutting findings (for the report)

| # | Finding | Severity (est.) | Epic |
|---|---|---|---|
| J1 | `useStopMessage` posts to `/chats/:chatId/messages/:messageId/stop`; the service only exposes `POST /chats/:chatId/stop`, so Stop most likely does nothing | High (functional) | 15, 11 |
| J2 | The AC-54 E2E step passes even if Stop does nothing (only checks non-empty text) | Medium (test debt) | 15 |
| J3 | Client ignores SSE connection errors; server sends no event ids/heartbeat; a drop at the wrong time leaves a reply stuck "streaming" | Medium | 9 |
| J4 | No timeout on LLM provider calls; a hung provider blocks the chat's queue until Stop | Medium | 14 |
| J5 | `/health` in both services returns ok without checking the database | Low/Medium | 14 |
| J6 | axe-core helper exists but no spec uses it: accessibility untested | Medium (test debt) | 10 |
| J7 | Pact scaffolding but zero contracts; no OpenAPI spec; services duplicate schemas instead of using `@app/shared-types` | Medium (test debt) | 11, 12 |
| J8 | The remote-failure E2E blocks every `remoteEntry.js` at once, so per-remote isolation is never proven | Low (test debt) | 8 |
| J9 | Message queue is process-local: ordering guarantees hold for one conversation-service instance only | Low (design limit) | 13 |
| J10 | Epic AICHAT-15 asks that navigating away aborts the reply; the product (AC-60/61) keeps replies running across chat switches | Requirement conflict | 15 |
| J11 | `stopped` flag exists in the SSE type but is never rendered | Low (UX) | 15 |

## Decisions needed from the team (DoR blockers)

1. Remote load timeout (AICHAT-8).
2. Recovery rule for dropped streams; heartbeat (AICHAT-9).
3. Page × theme matrix for the scans (AICHAT-10).
4. Pact sharing: CI artifacts vs broker; how to fix the stop route (AICHAT-11, AICHAT-15).
5. Schema source of truth: service contracts vs shared-types (AICHAT-12).
6. Retry-during-stream and double-submit behaviour (AICHAT-13).
7. LLM timeout value (app change) and readiness check (AICHAT-14).
8. "Navigating away" rule (AICHAT-15).
9. Mutation targets and thresholds (AICHAT-16).
