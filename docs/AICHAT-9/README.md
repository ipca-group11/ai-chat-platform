---
title: "AICHAT-9 · [Foundations] SSE reconnection testing"
---

# AICHAT-9 · [Foundations] SSE reconnection testing

| Field | Value |
|---|---|
| Jira | [AICHAT-9](https://ipca-grupo11.atlassian.net/browse/AICHAT-9) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Depends on | AICHAT-144 (mock LLM for slow, deterministic streams) |
| Related | AICHAT-15 (stream cancellation), AICHAT-14 (network-drop chaos), AICHAT-17 (shared fake `EventSource`) |
| Layer | LLM streaming: `apps/mfe-chat` ↔ `services/conversation-service` |

## 1. Goal

A network drop in the middle of a streamed reply never leaves the UI hanging: the chat **resumes** or **resyncs** the reply, or
shows a **clear error**, as agreed. Covered at unit (client), service (server) and E2E level, plus one documented run through
the reverse proxy on the VM.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Vitest + fake `EventSource`, supertest, Playwright `context.setOffline`
- [ ] Target environment available (local, CI, VM for US5)
- [ ] **Expected behaviour decided (resume or clear error)** → options in §4.3, decided in US1

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Network drop mid-stream tested
- [ ] The UI resumes or shows the error and never hangs

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| `EventSource` (browser) | — | Client transport, auto-reconnects after a transport error |
| Express SSE | `^4.22` | `GET /chats/:chatId/stream`, `text/event-stream` |
| Vitest + fake `EventSource` | `5.0.1` | Client drop/reconnect unit tests |
| supertest / raw `http` | `^7.2.1` | Server disconnect tests |
| Playwright | `1.63.0` | `context.setOffline(true/false)` mid-stream |
| Caddy (VM) | `deploy/` | Reverse proxy timeouts for idle streams |

## 4. Discovery: current state

### 4.1 Server

| File | Behaviour |
|---|---|
| `services/conversation-service/src/features/streaming/sse.ts` | `ChatEventBus`: in-process `EventEmitter` per chat, **no buffer / replay**. `writeSseEvent` writes `event:` + `data:` only: **no `id:`, no `retry:`** |
| `services/conversation-service/src/features/streaming/routes.ts` | Access check, `initSseResponse`, subscribe; on `req.close` unsubscribes and decrements `active_streams`. **No heartbeat** |
| `services/conversation-service/src/features/queue/*` | Generation runs in the queue, independent of SSE clients; a disconnect does not stop it |

### 4.2 Client

| File | Behaviour |
|---|---|
| `apps/mfe-chat/src/shared/sse.ts` | `subscribeToChatStream` splits server `error` events (with data) from transport errors (`onConnectionError`) |
| `apps/mfe-chat/src/features/chat-view/model/stream-registry.ts` | Module-level registry, one stream per chat. **Does not pass `onConnectionError`**, so drops are ignored; `onDone` sets status `sent` and refetches messages |

### 4.3 What happens on a drop today

1. `EventSource` reconnects on its own after ~3 s (browser default; no `retry:` sent).
2. Tokens published during the gap are **lost** (no ids, no replay).
3. If `done` is published during the gap, the assistant message **stays `streaming`** in the React Query cache until something
   else refetches it. This is the "UI hangs" case the epic targets.

Options for US1: **(a)** Last-Event-ID replay (server buffer per chat), **(b)** refetch the message list on reconnect (smallest
change, client only), **(c)** show an error and let the user reload. **(b)** is the likely recommendation.

### 4.4 Existing tests

- `apps/mfe-chat/src/features/chat-view/components/ChatView.test.tsx` has a fake `EventSource` for happy-path streaming; no test
  simulates a transport error.
- `services/conversation-service/src/features/streaming/routes.spec.ts` already checks access (AC-45/46), event delivery (AC-52)
  and that **the stream counter drops when the client disconnects**. US3 reuses it and adds: generation persists with no
  client, a new connection gets later events, heartbeat/replay if adopted.
- No E2E test drops the network.

## 5. Implementation plan (steps)

1. Decide the behaviour (US1) with the mfe-chat / conversation-service owners; note any app change it needs.
2. Client unit tests: error routing in `sse.ts`; `stream-registry.ts` wires `onConnectionError` and recovers on `open`.
3. Server tests: disconnect frees the subscription and the gauge; generation still persists; new connection gets later events;
   heartbeat (if adopted) with fake timers.
4. E2E (`e2e/src/tests/sse-reconnection.spec.ts`): offline mid-stream → online → final text equals persisted text after reload;
   drop spanning `done`; long drop shows the agreed indicator. Mock LLM for a slow stream.
5. VM run: hold a stream idle longer than the proxy timeout; capture `curl -N` output.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-167](https://ipca-grupo11.atlassian.net/browse/AICHAT-167) | AICHAT-9-US1 | As a team, I want an agreed behaviour for a dropped stream | Gaps of §4 documented; option chosen and recorded; app changes agreed with owners | 1 |
| [AICHAT-168](https://ipca-grupo11.atlassian.net/browse/AICHAT-168) | AICHAT-9-US2 | As a developer, I want the client stream code tested for drops and reconnects | Error routing in `sse.ts`; recovery in `stream-registry.ts`; no message left `streaming`; shared fake `EventSource` | 3 |
| [AICHAT-169](https://ipca-grupo11.atlassian.net/browse/AICHAT-169) | AICHAT-9-US3 | As a developer, I want the SSE endpoint tested for disconnects | Unsubscribe + gauge; generation persists; new connection gets later (or replayed) events; heartbeat if adopted | 3 |
| [AICHAT-170](https://ipca-grupo11.atlassian.net/browse/AICHAT-170) | AICHAT-9-US4 | As a user, I want the chat to recover or tell me when my connection drops | Offline/online mid-stream; drop spanning `done`; long drop indicator; mock LLM; merge gate | 5 |
| [AICHAT-171](https://ipca-grupo11.atlassian.net/browse/AICHAT-171) | AICHAT-9-US5 | As a user of the deployed app, I want idle streams to survive the proxy | Documented VM run longer than the proxy timeout; stays open or recovers; evidence attached | 2 |
| | | **Total** | | **14** |

## 7. Risks and open decisions

- Option (a) needs a per-chat event buffer in a process-local bus: memory and multi-instance limits.
- `context.setOffline` does not always close an open `EventSource` immediately in Chromium; may need `page.route` abort instead.
- Heartbeat comments must not be parsed as events by the client.

## 8. Notes for the report

Streaming is decoupled from generation, which is good: a dropped client never kills the reply. But the client ignores
connection errors and the server sends no event ids or heartbeat, so a drop at the wrong moment leaves a reply stuck in the
streaming state until something refetches it. The epic first decides the recovery rule, then tests it at the three layers and
through the real proxy.
