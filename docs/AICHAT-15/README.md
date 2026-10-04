---
title: "AICHAT-15 · [Foundations] Stream cancellation testing"
---

# AICHAT-15 · [Foundations] Stream cancellation testing

| Field | Value |
|---|---|
| Jira | [AICHAT-15](https://ipca-grupo11.atlassian.net/browse/AICHAT-15) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Depends on | AICHAT-144 (mock LLM server that records connection close) |
| Related | AICHAT-11 (contract test catches the stop mismatch), AICHAT-9 (SSE), AICHAT-13 (queue) |
| Layer | LLM streaming: Stop button → API → queue → provider adapter |

## 1. Goal

The **Stop button** and **navigating away** (as agreed) **abort the upstream provider request**, and the reply is **saved and
marked as stopped**. Proven with a mock LLM that records when the connection is closed.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Vitest/supertest for the chain, mock LLM for the upstream close, Playwright for the UI
- [ ] Target environment available
- [ ] **Mock LLM server that records connection close** → AICHAT-144

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Stop button and navigating away both abort the upstream request → **"navigating away" conflicts with the design, see §4.3 / US5**
- [ ] The message is marked as stopped

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| `AbortController` / `fetch` signal | Node 24 | Cancellation chain from the queue to the provider |
| Vitest + supertest | `5.0.1` / `^7.2.1` | Hook URL, route, processor, adapters |
| Mock LLM (AICHAT-144) | — | Slow SSE stream in OpenAI/Anthropic format; logs socket close |
| Playwright | `1.63.0` | Stop button E2E with request assertions |

## 4. Discovery: current state

### 4.1 Cancellation chain (server)

`POST /chats/:chatId/stop` (`messages/routes.ts`) → `MessagesService.stop` → `QueueManager.stop` → `ChatQueue.stopActive()`
aborts the active `AbortController` → `processor.ts` passes `{ signal }` to the adapter → `openai.provider.ts` /
`anthropic.provider.ts` pass it to `fetch` → on abort the processor publishes `done` with `stopped: true`.

Already tested: `messages/routes.spec.ts` (AC-54: stop returns `{ stopped: true }`), `messages/processor.spec.ts` (abort →
`done.stopped`, in-flight web fetch not saved), `queue/chat-queue.spec.ts` (`stopActive` aborts), `openai.provider.spec.ts`
(rejected `AbortError` propagates). **Not tested:** abort **mid-read** of a stream, the Anthropic adapter's abort, and that the
upstream socket is really closed.

### 4.2 Client: Stop button calls a route that does not exist

`useStopMessage` in `apps/mfe-chat/src/features/chat-view/api/messages.ts` posts to
**`/chats/:chatId/messages/:messageId/stop`**; the service exposes **`POST /chats/:chatId/stop`**. The request most likely
returns 404 and nothing is stopped. The E2E step "AC-54: stopping mid-stream saves the partial response"
(`e2e/src/tests/chat.spec.ts`) only asserts the reply is non-empty after the stream ends, so it **passes even if Stop does
nothing**. Also, the `stopped` flag exists only in `apps/mfe-chat/src/shared/types.ts`; no component renders it.

### 4.3 Navigating away

By design (AC-60/61) a reply keeps generating when the user switches chats: streams live in a module-level registry
(`stream-registry.ts`) and closing an SSE connection does not touch the queue (`streaming/routes.ts`). The epic's "navigating
away aborts the upstream request" therefore needs a decision per case (switch chat, close tab, logout, leave shared chat).

## 5. Implementation plan (steps)

1. Fix the client URL (or add the route), pin it with a hook unit test; extend the route spec with idle (`stopped:false`) and
   non-member cases.
2. Adapter tests: abort while reading a mock stream (`test-utils/mock-stream.ts`) → no further tokens, reader released, for both
   providers; `http-stream.ts` abort path.
3. Mock LLM integration test: start a slow stream, POST stop, assert the mock logged the close within the agreed time; control
   case without stop.
4. Persistence/UI: partial content saved, stopped state after reload, indicator in `MessageBubble`, next queued message starts.
5. Navigating away: agree the rule, then one E2E per case.
6. Rewrite the AC-54 E2E step: wait for the stop response (2xx), assert the text stops growing and is shorter than the full mock reply.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-199](https://ipca-grupo11.atlassian.net/browse/AICHAT-199) | AICHAT-15-US1 | As a user, I want the Stop button to actually reach the server | URL mismatch confirmed and fixed; hook URL pinned; route: true/false/403-404 | 2 |
| [AICHAT-200](https://ipca-grupo11.atlassian.net/browse/AICHAT-200) | AICHAT-15-US2 | As a developer, I want each adapter tested for abort mid-stream | Both adapters pass the signal; no tokens after abort; `http-stream` releases the reader; processor `done.stopped` | 3 |
| [AICHAT-201](https://ipca-grupo11.atlassian.net/browse/AICHAT-201) | AICHAT-15-US3 | As a product owner, I want proof the provider connection closes on stop | Mock records close; within agreed time for both formats; control case | 3 |
| [AICHAT-202](https://ipca-grupo11.atlassian.net/browse/AICHAT-202) | AICHAT-15-US4 | As a user, I want a stopped reply saved and marked as stopped | Partial text persisted; stopped state after reload; UI indicator; next queued starts | 3 |
| [AICHAT-203](https://ipca-grupo11.atlassian.net/browse/AICHAT-203) | AICHAT-15-US5 | As a team, I want an agreed rule for leaving a chat during a reply | Conflict recorded; rule per case; E2E per case | 3 |
| [AICHAT-204](https://ipca-grupo11.atlassian.net/browse/AICHAT-204) | AICHAT-15-US6 | As a tester, I want the stop E2E to fail when stop does not work | Gap documented; stop 2xx, text stops growing, shorter than full reply; mock LLM; merge gate | 2 |
| | | **Total** | | **16** |

## 7. Risks and open decisions

- Whether the processor keeps or discards partial text on stop must match what the UI shows.
- The "navigating away" rule may change the epic's DoD; record the decision in the epic.
- US3 depends on the mock LLM and the env-configurable base URL from AICHAT-144.

## 8. Notes for the report

The server side of cancellation was implemented and unit-tested, but the chat UI sends Stop to a route that does not exist, and
the end-to-end test could not notice because it only checked that some text was saved. The epic fixes the route, proves the
upstream request is really closed with a mock provider, and makes the E2E test fail when Stop does nothing. It also surfaces a
requirement conflict: the epic says leaving a chat should abort the reply, while the product deliberately keeps replies
running across chat switches.
