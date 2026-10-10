---
title: "AICHAT-9 · SSE reconnection testing: work log"
---

# AICHAT-9 · SSE reconnection testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-9](https://ipca-grupo11.atlassian.net/browse/AICHAT-9) |
| Analysis | [README.md](README.md) |
| Owner | João Vieira |
| Branch | `test/AICHAT-9-sse-reconnection` (built on `test/AICHAT-12-api-schema-validation`, PR #33 not merged yet) |
| Started / finished | 2026-10-10 / … |
| Pull requests | not opened yet (commits are local; pushed by the owner) |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-10

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | João Vieira | — |
| Scope and tooling agreed | Met | Vitest + shared fake `EventSource`, supertest, Playwright `context.setOffline` against the mock LLM? | Agreed as written; US4 becomes a merge gate in `e2e.yml` | João Vieira |
| Target environment available | Met | How do we get a run on the Azure VM for US5? | Local and CI for US2–US4 (the mock LLM of AICHAT-144 is available). US5: we provide a script, the owner runs it on the VM and the output is attached | João Vieira |
| Expected behaviour decided | Met | What happens when the stream drops mid-reply? | Option **(b)**: refetch the message list on reconnect (see US1) | João Vieira |

Decisions:

| Topic | Decision |
|---|---|
| Stream drop (AICHAT-167) | Refetch on reconnect, client only. No `id:` / Last-Event-ID replay, so the stream contract (AICHAT-12 schema, AICHAT-11 pacts) does not change |
| Indicator while the connection is down | The chat shows a "Reconnecting…" status (`role="status"`) from the transport error until the stream is open again |
| Browser gives up (`EventSource` `CLOSED`) | The client closes it and opens a new stream after a short delay; the new `open` triggers the same refetch |
| Heartbeat | Yes: the server writes the SSE comment `: ping` every 15 s on each open stream, so idle streams are not cut by Caddy or the Azure idle timeout (~4 min) |

Blockers: none.

## 2. Environment

![Environment](evidence/00-environment.png)

| Tool | Version | Install |
|---|---|---|
| macOS | 27.0.1 | — |
| Node | v26.8.2 locally (CI uses Node 24 from `.nvmrc`) | nvm |
| pnpm | 10.4.0 (pinned in `package.json`) | `pnpm install --frozen-lockfile` |
| Docker | 29.7.2 | Docker Desktop |
| Playwright | 1.63.0 | workspace dev dependency |

## 3. Steps

### US1 · Agree the expected behaviour when the SSE stream drops ([AICHAT-167](https://ipca-grupo11.atlassian.net/browse/AICHAT-167))

**What and why.** Before testing "the UI never hangs" we had to agree what "not hanging" means. We read the stream code on
both sides and listed what happens today when the connection drops in the middle of a reply.

**Gaps found.**

| # | Where | Gap | Effect |
|---|---|---|---|
| 1 | `services/conversation-service/src/features/streaming/sse.ts` (`writeSseEvent`) | Events carry only `event:` and `data:`: no `id:`, no `retry:` | The browser cannot ask for missed events (`Last-Event-ID`); it retries after its default delay (~3 s) |
| 2 | same file (`ChatEventBus`) | Plain `EventEmitter`, no buffer or replay | Events published while no client is connected are lost |
| 3 | `streaming/routes.ts` | No heartbeat | An idle stream (a slow model, a long queue) can be cut by a proxy or a load balancer idle timeout |
| 4 | `apps/mfe-chat/src/features/chat-view/model/stream-registry.ts` | Does not pass `onConnectionError` to `subscribeToChatStream` | Drops are ignored. If `done` is published during the gap, the reply stays `streaming` in the React Query cache until something else refetches it: **the UI hangs** |

**Options and decision.**

| Option | Change | Verdict |
|---|---|---|
| (a) Last-Event-ID replay | Server: an `id:` per event and a buffer per chat; the browser sends `Last-Event-ID` on reconnect | Rejected: changes the stream contract and adds state to the server, for a gap the database already covers |
| **(b) Refetch on reconnect** | Client: on the transport error show "Reconnecting…"; on the next `open` refetch `GET /chats/:id/messages` | **Chosen.** The database is the source of truth: the processor saves the reply text when it ends (done, stop or error), so a refetch after the gap shows the final text and status |
| (c) Clear error only | Client: mark the reply failed and ask the user to reload | Rejected: the reply is not failed, it is still being generated |

The heartbeat (`: ping` every 15 s) is added on the server. A line that starts with `:` is a comment in the SSE format: the
browser ignores it, but bytes keep flowing, so proxies see the connection as active.

**Known limitation of (b).** `processor.ts` creates the reply row empty (`status: "streaming"`) when it starts and writes
the text only at the end. A reconnect **while the reply is still being generated** therefore reads `content: ""` from the
server. The client keeps the text it already shows for a reply the server still reports as `streaming` (otherwise the text
would disappear), so the tokens published during the gap are missing on screen until `done`; `onDone` refetches and the
saved, complete text replaces it. Closing that gap would need option (a).

**App changes agreed with the owners.** mfe-chat: `subscribeToChatStream` gets an `onOpen` handler; `stream-registry.ts`
wires `onConnectionError`, `onOpen` and the "Reconnecting…" state. conversation-service: heartbeat in the stream route. The
owner of both apps for this epic is João Vieira.

**Result.** Decision recorded here and in the Jira epic comment (2026-10-10). US2–US5 test against it.
