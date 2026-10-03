---
title: "AICHAT-13 · [Foundations] Concurrency testing"
---

# AICHAT-13 · [Foundations] Concurrency testing

| Field | Value |
|---|---|
| Jira | [AICHAT-13](https://ipca-grupo11.atlassian.net/browse/AICHAT-13) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Depends on | AICHAT-144 (mock LLM for the E2E story) |
| Related | AICHAT-15 (stop), AICHAT-24 (load testing) |
| Layer | Multi-user data: per-chat message queue in conversation-service |

## 1. Goal

**Two simultaneous sends** and **retry during a stream** (plus edit/cancel races and shared-chat members typing at once) never
produce **duplicate or lost messages**, and replies come back in a defined order.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Vitest with deferred promises (unit), supertest + `Promise.all` (service), two Playwright contexts (E2E)
- [ ] Target environment available
- [ ] **Expected result defined (reject, queue or order)** → current design in §4.1, confirmed in US1

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Two simultaneous sends and retry-during-stream tested
- [ ] No duplicate or lost messages

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| Vitest | `5.0.1` | Unit tests with controlled promise resolution, fake timers |
| supertest | `^7.2.1` | Concurrent HTTP calls against the app with fakes |
| Playwright | `1.63.0` | Two browser contexts (owner + member) |
| In-memory fakes | `services/conversation-service/src/test-utils/` | Repositories, mock stream |

## 4. Discovery: current state

### 4.1 Design

| File | Behaviour |
|---|---|
| `features/queue/chat-queue.ts` | Per-chat FIFO; one active entry with its own `AbortController`; queued entries can be edited/cancelled in place; once active only stop/abort |
| `features/queue/queue-manager.ts` | One `ChatQueue` per chat; `submit` returns `started` or `queued` and pumps the loop; failures never stop the loop (AC-74); chats run independently (AC-60/61) |
| `features/messages/service.ts` | `cancelQueued` → 409 `MESSAGE_NOT_CANCELABLE` once active; `stop(chatId)` |
| `features/messages/routes.ts` | send, edit, cancel, retry, stop |
| `apps/mfe-chat/.../stream-registry.ts` | Upserts messages by id, so a duplicate SSE `message` event is idempotent on the client |

### 4.2 Observations

- The queue is **process-local** (in-memory Map). With more than one conversation-service replica, two sends to the same chat
  could run on different instances in parallel: ordering is only guaranteed with one instance.
- No idempotency key on `POST /messages`: a double-submit is two messages unless the UI prevents it.
- Retry while another reply is active: behaviour must be read from the service and confirmed (queued vs rejected).

### 4.3 Existing tests

Already covered (sequentially): `queue/chat-queue.spec.ts` (FIFO, edit/cancel queued vs active, `stopActive`) and
`queue/queue-manager.spec.ts` (started vs queued, order, **two chats concurrently** (AC-60/61), **processor failure does not block**
(AC-74), stop/edit/cancel delegation). Also `messages/{service,routes,processor}.spec.ts`.

**Not covered:** operations **interleaved at the same instant** (cancel exactly as an entry becomes active), parallel HTTP sends
to one chat with persistence checked, retry during an active stream, double retry, two users in a shared chat. US2 therefore
extends the existing specs with race cases instead of re-testing what is there.

## 5. Implementation plan (steps)

1. US1: list scenarios and expected result; record the single-instance limit.
2. Unit: deferred processor promises to control timing; interleave submit/stop/edit/cancel; assert order and return values;
   throwing processor does not stall.
3. Service: `Promise.all` of N sends with a mock provider; count user + assistant messages; order; two chats in parallel;
   run 50× in CI to catch flakes.
4. Races: retry during stream, double retry, edit/cancel vs start; final list checked for duplicates and gaps.
5. E2E: owner and member contexts send at once; both views equal; double-click Send = one message.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-189](https://ipca-grupo11.atlassian.net/browse/AICHAT-189) | AICHAT-13-US1 | As a team, I want the expected result agreed per concurrent scenario | Scenarios listed; result per scenario from the current design; single-instance limit recorded | 1 |
| [AICHAT-190](https://ipca-grupo11.atlassian.net/browse/AICHAT-190) | AICHAT-13-US2 | As a developer, I want the queue tested with interleaved operations | Deferred promises; FIFO kept; cancel at activation returns false; stop only active; throwing processor ok | 3 |
| [AICHAT-191](https://ipca-grupo11.atlassian.net/browse/AICHAT-191) | AICHAT-13-US3 | As a user, I want rapid sends saved once and answered in order | N concurrent sends → N + N persisted; arrival order; two chats parallel; 50× no flakes | 5 |
| [AICHAT-192](https://ipca-grupo11.atlassian.net/browse/AICHAT-192) | AICHAT-13-US4 | As a user, I want retry/edit/cancel to behave predictably during a stream | Retry during stream per US1; double retry = one reply; edit/cancel vs start never both | 3 |
| [AICHAT-193](https://ipca-grupo11.atlassian.net/browse/AICHAT-193) | AICHAT-13-US5 | As a member of a shared chat, I want everyone to see the same messages in order | Two contexts send at once; equal views; double-click = one message; mock LLM; merge gate | 3 |
| | | **Total** | | **15** |

## 7. Risks and open decisions

- Timing-based tests are flaky; drive timing with deferred promises, not `setTimeout`.
- Whether to add an idempotency key (app change) or rely on UI prevention for double-submit.
- Multi-instance ordering is out of scope unless the team plans to scale conversation-service horizontally.

## 8. Notes for the report

The per-chat FIFO queue is a sound design for ordering, but only its happy paths were tested and its guarantees hold only for
one service instance. The epic proves no duplicates or losses under parallel sends and racing edits/retries, and makes the
single-instance assumption explicit.
