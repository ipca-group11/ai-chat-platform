---
name: aichat-15-stream-cancellation-testing
description: Run epic AICHAT-15 (Stream cancellation testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-15", "work on AICHAT-15", "continue AICHAT-15".
---

# AICHAT-15 · [Foundations] Stream cancellation testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-15. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-15 · [Foundations] Stream cancellation testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-15-stream-cancellation` |
| Work log | `docs/AICHAT-15/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-15/evidence/` |
| Layer | LLM streaming: Stop button → API → queue → provider adapter |
| Depends on | AICHAT-144 (mock LLM that records connection close) for US3, US6 |
| Related | AICHAT-11 (contract test catches the stop mismatch), AICHAT-9, AICHAT-13 |

## Goal

The **Stop button** and **navigating away** (as agreed) **abort the upstream provider request**, and the reply is **saved and
marked as stopped**.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-15/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-15/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-15/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-15/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: Vitest/supertest for the chain, mock LLM for the upstream close, Playwright for the UI
2. Target environment available
3. Mock LLM server that records connection close → AICHAT-144 status

Open decisions from the analysis (ask the ones not already settled):
  - **Stop URL fix:** change the client to `POST /chats/:chatId/stop` (Recommended) or add the route the client calls.
  - **Navigating away** (conflicts with AC-60/61): keep replies running on chat switch, abort only on logout (Recommended) / abort on every navigation / other; update the epic DoD if changed.
  - Partial text on stop: keep (Recommended, matches current processor) or discard.

## Stories (run one subagent per story, in this order)

US1 first (unblocks everything that clicks Stop). US2 in parallel with US1. US5 decision in the main thread after the DoR.
Then US3, US4, US6. Server-side stop is already partly tested (`messages/routes.spec.ts` AC-54, `processor.spec.ts`
abort → `done.stopped`, `chat-queue.spec.ts`): agents extend those specs, not duplicate them.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-199 | Fix and test the Stop endpoint contract between mfe-chat and the API | 2 | Mismatch confirmed and fixed (`useStopMessage` posts to `/chats/:chatId/messages/:messageId/stop`, router exposes `POST /chats/:chatId/stop`); unit test pins the hook URL; supertest: stopped true while streaming, false when idle, 403/404 for non-member |
| AICHAT-200 | Abort propagates to the provider adapters and http-stream | 3 | openai and anthropic providers pass the signal to fetch; abort mid-read emits no further tokens; `http-stream.ts` stops and releases the reader (uses `test-utils/mock-stream.ts`); processor publishes done with stopped true, not error |
| AICHAT-201 | Mock LLM proves the upstream connection is closed on stop | 3 | Mock streams slowly and records client close; after POST stop the close is seen within the agreed time (e.g. 500 ms) for OpenAI and Anthropic formats; control case without stop sees the full stream |
| AICHAT-202 | Stopped reply is saved and shown as stopped | 3 | Partial content persisted; done carries stopped true; agreed stopped state after reload; MessageBubble shows a stopped indicator (flag not rendered today); next queued message starts right after |
| AICHAT-203 | Decide and test what navigating away does to a running reply | 3 | Conflict recorded (AC-60/61: generation continues on chat switch; closing SSE does not abort); rule agreed per case (switch chat, close tab, logout, leave shared chat), epic DoD updated if needed; E2E per case |
| AICHAT-204 | Strengthen the AC-54 E2E step so it really proves cancellation | 2 | Gap documented (AC-54 step in `e2e/src/tests/chat.spec.ts` only checks non-empty text); new assertions: stop request 2xx, text stops growing, saved reply shorter than the full mock reply; mock LLM; merge gate |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Stop button and navigating away (per the agreed rule) both abort the upstream request
- [ ] The message is marked as stopped
