---
name: aichat-13-concurrency-testing
description: Run epic AICHAT-13 (Concurrency testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-13", "work on AICHAT-13", "continue AICHAT-13".
---

# AICHAT-13 · [Foundations] Concurrency testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-13. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-13 · [Foundations] Concurrency testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-13-concurrency` |
| Work log | `docs/AICHAT-13/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-13/evidence/` |
| Layer | Multi-user data: per-chat message queue in conversation-service |
| Depends on | AICHAT-144 (mock LLM) for US5 |
| Related | AICHAT-15 (stop), AICHAT-24 (load testing) |

## Goal

**Two simultaneous sends** and **retry during a stream** (plus edit/cancel races and shared-chat members typing at once)
never produce **duplicate or lost messages**, and replies come back in a defined order.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-13/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-13/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-13/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-13/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: deferred promises (unit), supertest + `Promise.all` (service), two Playwright contexts (E2E)
2. Target environment available
3. Expected result: keep today's design, per-chat FIFO, 409 once active (Recommended) / change behaviour

Open decisions from the analysis (ask the ones not already settled):
  - Retry while another reply is active: queue it (Recommended if that is what the service does) or reject with 409.
  - Double-submit: UI prevention only (Recommended) vs an idempotency key on `POST /messages` (app change).
  - Multi-instance ordering: out of scope, record the single-instance assumption (Recommended).

## Stories (run one subagent per story, in this order)

US1 in the main thread. US2, US3 and US4 in parallel (different spec files). US5 last.
US2 **extends** the existing `queue/*.spec.ts` (FIFO, two chats, AC-74 are already covered): add only race cases.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-189 | Define the expected result for each concurrent scenario | 1 | Scenarios listed (two sends one chat, double-click, retry while streaming, edit/cancel as it starts, two members, two chats); expected result per scenario from the current design (FIFO QueueManager, 409 MESSAGE_NOT_CANCELABLE); single-instance limit recorded |
| AICHAT-190 | Race-condition unit tests for ChatQueue and QueueManager | 3 | `chat-queue.ts` and `queue-manager.ts` driven with deferred promises, submit/stop/editQueued/cancelQueued interleaved; FIFO kept; cancel at activation returns false; stop only aborts active; throwing processor never stalls; two chats independent |
| AICHAT-191 | Parallel sends to one chat: no duplicate or lost messages | 5 | N concurrent `POST /chats/:chatId/messages` with a mock provider; exactly N user + N assistant messages persisted; arrival order; first started, rest queued; two chats in parallel; repeated 50× without flakes |
| AICHAT-192 | Retry, edit and cancel while a reply is streaming | 3 | Retry during an active stream gives the US1 result; two retries at once create one reply; PATCH/DELETE racing with start: applied or 409, never both; final list checked for duplicates and gaps |
| AICHAT-193 | E2E: two members send at once in a shared chat | 3 | Owner and member contexts send at the same moment; both views show each message once in the same order; double-click Send = one message; mock LLM; merge gate in e2e.yml |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Two simultaneous sends and retry-during-stream tested
- [ ] No duplicate or lost messages
