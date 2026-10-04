---
name: aichat-9-sse-reconnection-testing
description: Run epic AICHAT-9 (SSE reconnection testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-9", "work on AICHAT-9", "continue AICHAT-9".
---

# AICHAT-9 · [Foundations] SSE reconnection testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-9. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-9 · [Foundations] SSE reconnection testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-9-sse-reconnection` |
| Work log | `docs/AICHAT-9/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-9/evidence/` |
| Layer | LLM streaming: `apps/mfe-chat` ↔ `services/conversation-service` |
| Depends on | AICHAT-144 (mock LLM) for US4 |
| Related | AICHAT-15 (cancellation), AICHAT-14 (chaos), AICHAT-17 (shared fake `EventSource`) |

## Goal

A network drop in the middle of a streamed reply never leaves the UI hanging: the chat **resumes** or **resyncs** the reply,
or shows a **clear error**, as agreed.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-9/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-9/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-9/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-9/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: Vitest + fake `EventSource`, supertest, Playwright `context.setOffline`
2. Target environment available (local, CI, VM for US5)
3. Expected behaviour on a drop: (b) refetch messages on reconnect (Recommended) / (a) Last-Event-ID replay / (c) clear error only

Open decisions from the analysis (ask the ones not already settled):
  - Add a server heartbeat (`: ping` every N s) to keep idle streams open through the proxy?
  - App changes in mfe-chat / conversation-service needed by the chosen option: agreed with their owners?
  - Is the mock LLM (AICHAT-144) available for US4? If not, flag Impediment on US4 only.

## Stories (run one subagent per story, in this order)

US1 is a decision (main thread, right after the DoR review). US2 and US3 in parallel. Then US4, then US5.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-167 | Agree the expected behaviour when the SSE stream drops | 1 | Gaps documented (no `id:`/`retry:`/heartbeat, no replay in ChatEventBus, `stream-registry.ts` never passes `onConnectionError`); option chosen and recorded; app changes agreed with owners |
| AICHAT-168 | mfe-chat: unit tests for connection drop and reconnect handling | 3 | `shared/sse.ts`: transport error → onConnectionError, server error event → onError; `stream-registry.ts` runs the agreed recovery on reconnect; no message left `streaming` after a drop; uses the shared fake EventSource helper |
| AICHAT-169 | conversation-service: stream disconnect and resubscribe tests | 3 | Close unsubscribes and decrements active_streams (extend `streaming/routes.spec.ts`); generation continues and persists with no client; new connection receives later (or replayed) events; heartbeat with fake timers if adopted |
| AICHAT-170 | E2E: network drop mid-stream never hangs the UI | 5 | `context.setOffline(true)` mid-stream then online: final text equals persisted text after reload; drop spanning done: not stuck streaming; long drop: agreed indicator visible; mock LLM; merge gate in e2e.yml |
| AICHAT-171 | Idle stream survives the reverse proxy (Caddy) on the VM | 2 | Documented run on the VM holding a stream idle longer than the proxy timeout; stays open (heartbeat) or recovers as agreed; curl -N output or network capture attached |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Network drop mid-stream tested
- [ ] The UI resumes or shows the error and never hangs
