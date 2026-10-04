---
title: "AICHAT-20 · SSE type drift between mfe-chat and shared-types"
---

# SSE type drift between mfe-chat and shared-types

Source of this file: story [AICHAT-113](https://ipca-grupo11.atlassian.net/browse/AICHAT-113) of epic [AICHAT-20](https://ipca-grupo11.atlassian.net/browse/AICHAT-20). The Jira ticket for the chat owner is raised from this file.

## Status: fixed in AICHAT-221

[AICHAT-221](https://ipca-grupo11.atlassian.net/browse/AICHAT-221) made shared-types the single source of the stream events. The sections below "Summary" describe the drift as it was found and are kept as the record.

| What | Now |
|---|---|
| Definition | `packages/shared-types/src/stream-events.ts`: `sseEventSchema` and one schema per event, with the message, attachment and web fetch shapes they carry (`messageDtoSchema`, `attachmentDtoSchema`, `webFetchSchema`). Re-exported from `chat/sse.ts`, so `chat.sseEventSchema` is the same schema. Self-contained (only `zod`), built to `dist/` and exported as `@app/shared-types/stream-events`, like `model-capabilities`. |
| Events | `message`, `queued`, `started`, `token`, `reasoning`, `web_fetch`, `done` (`stopped?`, `truncated?`), `error` (`retryable`). `queued` has no `position`. `done.truncated` is new (AICHAT-212): the model hit its output limit. The message DTO has `truncated: boolean` (AICHAT-212). |
| conversation-service | `src/shared/contracts/chat.ts` has no SSE schemas any more; it re-exports the event types from `@app/shared-types/stream-events` (type-only, the runtime image does not ship the package's dependencies). `chat.spec.ts` checks that its message, attachment and web fetch DTO schemas equal the shared ones (same JSON Schema). |
| mfe-chat | `SSEEvent` in `src/shared/types.ts` is the shared `SseEvent` (no local copy); `WebFetch` is the shared type too. Path alias in `tsconfig.json` and `vite.config.ts` reads it from source. |
| mock server | `src/contract/backend.contract.spec.ts`: `STREAM_DRIFT` is empty for every event. |
| Drift test | `apps/mfe-chat/src/shared/sse-drift.test.ts` is now a plain equality check: `SSEEvent` must be the shared type (compile-time), the event names and fields of shared-types must equal the listed ones, and the chat must listen to every event except `queued` (the queue is shown by a refetch). |

The wider drift of the record schemas (`chat.messageSchema`, `attachmentSchema`, auth responses) is not part of this ticket; it stays listed in `DRIFT` of the mock-server contract test.

## Summary

`apps/mfe-chat` does not use `@platform/shared-types` for the stream events of `GET /chats/:id/stream`. It declares its own `SSEEvent` in `apps/mfe-chat/src/shared/types.ts`, and that type no longer matches `chat/sse.ts` in shared-types. The third definition, the one conversation-service really sends (`services/conversation-service/src/shared/contracts/chat.ts`), agrees with mfe-chat. So shared-types is the odd one out, but because mfe-chat never imports it, nothing in the build catches the difference.

| | Events | Differences |
|---|---|---|
| mfe-chat `SSEEvent` | `message`, `queued`, `started`, `token`, `reasoning`, `web_fetch`, `done`, `error` | |
| shared-types `SseEvent` | `token`, `reasoning`, `web_fetch`, `done`, `error`, `queued` | no `message`, no `started`; `queued` needs `position`; `error` has no `retryable`; `done` has no `stopped` |
| conversation-service `SseEvent` (what is sent) | same eight events as mfe-chat | same fields as mfe-chat |

## The two definitions side by side

| mfe-chat (`apps/mfe-chat/src/shared/types.ts`) | shared-types (`packages/shared-types/src/chat/sse.ts`) |
|---|---|
| `{ type: "message"; message: Message }` | **missing** |
| `{ type: "queued"; messageId: string }` | `{ type: "queued"; messageId: string; position: number }` (`position` is a required non-negative integer) |
| `{ type: "started"; messageId: string }` | **missing** |
| `{ type: "token"; messageId: string; token: string }` | `{ type: "token"; messageId: string; token: string }` |
| `{ type: "reasoning"; messageId: string; token: string }` | `{ type: "reasoning"; messageId: string; token: string }` |
| `{ type: "web_fetch"; messageId: string; fetch: WebFetch }` | `{ type: "web_fetch"; messageId: string; fetch: WebFetch }` (same fields) |
| `{ type: "done"; messageId: string; stopped?: boolean }` | `{ type: "done"; messageId: string }` |
| `{ type: "error"; messageId: string; message: string; retryable: boolean }` | `{ type: "error"; messageId: string; message: string }` |

Code as it is today.

mfe-chat:

```ts
export type SSEEvent =
  | { type: "message"; message: Message }
  | { type: "queued"; messageId: string }
  | { type: "started"; messageId: string }
  | { type: "token"; messageId: string; token: string }
  | { type: "reasoning"; messageId: string; token: string }
  | { type: "web_fetch"; messageId: string; fetch: WebFetch }
  | { type: "done"; messageId: string; stopped?: boolean }
  | { type: "error"; messageId: string; message: string; retryable: boolean };
```

shared-types:

```ts
export const sseEventSchema = z.discriminatedUnion("type", [
  sseTokenEventSchema,      // { type: "token", messageId, token }
  sseReasoningEventSchema,  // { type: "reasoning", messageId, token }
  sseWebFetchEventSchema,   // { type: "web_fetch", messageId, fetch }
  sseDoneEventSchema,       // { type: "done", messageId }
  sseErrorEventSchema,      // { type: "error", messageId, message }
  sseQueuedEventSchema,     // { type: "queued", messageId, position }
]);
```

## Why it matters

- A client written against shared-types would ignore `message` and `started`, and would treat a `queued` event without `position` as invalid.
- If shared-types is used to validate the stream (Pact in AICHAT-11, schema checks in AICHAT-12), the real stream fails on `message`, `started`, and on `queued` without `position`.
- The related `Message` and `WebFetch` types also differ (see the wider list below).

## Wider drift, shared-types against the services

Recorded in `docs/AICHAT-144/WORKLOG.md`, story US15 (the mock-server contract test), and not redone here. The mock follows the services; the test fails when this list changes.

| Kind | Service sends | shared-types says |
|---|---|---|
| auth `register`, `login`, `me` | `{ id, email }` | `authResponseSchema` is `{ user: { id, email, createdAt } }` |
| chat | has `ownerEmail` | no `ownerEmail` |
| message | `status` `sent`; `authorId`, `authorEmail`, `error`; `attachments` as objects; role may be `system` | statuses `complete` and `canceled` instead of `sent`; none of those fields; only `attachmentIds` |
| attachment | `filename`, `kind`, `size`, `messageId` | `originalFilename`, `ownerId`, `storedPath`, `extractedTextStatus`, mime type enum |
| stream events | events `message` and `started`; `queued` without `position`; `error` has `retryable`; `done` may have `stopped` | no `message` and no `started`; `queued` needs `position`; `error` without `retryable`; `done` without `stopped` |

Also found in the analysis (README section 4.3): two `LLM_API_KEY_HEADER` constants, in `api-keys/schema.ts` and `chat/provider.ts`.

## How the drift is guarded

Before AICHAT-221, `apps/mfe-chat/src/shared/sse-drift.test.ts` compared the event names and field names of both definitions and pinned the difference in an inline snapshot. Since AICHAT-221 it is a plain equality check (see the status table at the top): it fails when a local copy of the event type comes back, when shared-types changes an event, or when the chat stops listening to one.

Run it with:

```sh
pnpm --dir apps/mfe-chat exec vitest run src/shared/sse-drift.test.ts
```

## Proposed ticket for the chat owner

**Title.** Align mfe-chat stream event types with `@platform/shared-types`.

**Description.** mfe-chat declares its own `SSEEvent`; it differs from `packages/shared-types/src/chat/sse.ts` (table above). Pick one source of truth. Suggested: make shared-types match what conversation-service sends (add `message` and `started`, `done.stopped`, `error.retryable`, and decide whether `queued.position` exists), and make mfe-chat import `SseEvent` from shared-types. Then update the pinned snapshot in `sse-drift.test.ts`.

**Acceptance.** `sse-drift.test.ts` pins no difference; mfe-chat has no local copy of the stream event type; the mock-server contract test (AICHAT-144 US15) drift list for stream events is empty.
