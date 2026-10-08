---
title: "AICHAT-12 · API schema validation testing: work log"
---

# AICHAT-12 · API schema validation testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-12](https://ipca-grupo11.atlassian.net/browse/AICHAT-12) |
| Analysis | [README.md](README.md) |
| Owner | João Vieira |
| Branch | `test/AICHAT-12-api-schema-validation` (built on `test/AICHAT-11-contract-testing`) |
| Started / finished | 2026-10-08 / … |
| Pull requests | not opened yet (commits are local; pushed by the owner) |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-08

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | João Vieira | — |
| Scope and tooling agreed | Met | Zod → OpenAPI generator, supertest per route, Schemathesis Docker image? | Agreed as written | João Vieira |
| Target environment available | Met | — | Unit and integration level: in-process app with in-memory fakes (no Docker). Schemathesis: the compose stack with the mock LLM (`pnpm mock:up`), in CI | — |
| Shared Zod schemas cover every route | Not met → decided in US1 | Where does the single source of truth live? | Keep each service's `src/shared/contracts` and feature `schema.ts` files as the source; register them in an OpenAPI registry. The drift with `packages/shared-types` is documented and guarded, not moved | João Vieira |

Decisions:

| Topic | Decision |
|---|---|
| OpenAPI generator | `@asteasolutions/zod-to-openapi` 9.1.0 (peer `zod ^4`), `OpenApiGeneratorV31` → OpenAPI 3.1 |
| Rate limit in CI | New env var `RATE_LIMIT_MAX` on auth-service (default 300, production unchanged); the CI stack raises it so Schemathesis is not throttled. A seeded test user's cookie is passed to Schemathesis |

Blockers: none.

## 2. Environment

![Environment](evidence/00-environment.png)

| Tool | Version | Install |
|---|---|---|
| macOS | 27.0.1 | — |
| Node | v26.8.2 locally (CI uses Node 24 from `.nvmrc`) | nvm |
| pnpm | 10.4.0 (pinned in `package.json`) | `pnpm install --frozen-lockfile` |
| Docker | 29.7.2 | Docker Desktop |
| Zod | 4.6.5 (services), 3.24.1 (`apps/mfe-chat`) | workspace dependency |
| Vitest | 5.0.1 | workspace dev dependency |

## 3. Steps

### US1 · Route-to-schema inventory and a single source of truth ([AICHAT-183](https://ipca-grupo11.atlassian.net/browse/AICHAT-183))

**What and why.** "Every route is validated" only means something with a complete list of routes. We did not copy
the list from the analysis: both services already have a guard (`src/integration/route-inventory.spec.ts`, AICHAT-131)
that reads the routes from the running Express app with `listRoutes(app)`. That list is the inventory below. It has
**8** auth-service routes and **21** conversation-service routes; the analysis listed 5 + 16 and missed `DELETE /auth/me`,
`/health`, `/metrics` and the two `/internal` routes. For each route we wrote down the schema that parses the request
today and the schema (if any) that describes the response.

![Routes registered by each app](evidence/03-route-inventory.png)

**auth-service** (contracts in `src/shared/contracts/{auth,http}.ts`)

| Route | Auth | Request schema | Response (success) | Response schema today |
|---|---|---|---|---|
| `GET /health` | — | — | 200 `{ status: "ok" }` | none |
| `GET /metrics` | — | — | 200 Prometheus text | n/a (not JSON) |
| `POST /auth/register` | — | `registerRequestSchema` | 201 `{ id, email }` | none (`authResponseSchema` describes `{ user: { id, email, createdAt } }`, which no route returns) |
| `POST /auth/login` | — | `loginRequestSchema` (invalid body → 401, on purpose: AC-36) | 200 `{ id, email }` + `Set-Cookie` | none |
| `POST /auth/refresh` | refresh cookie | — | 204 + `Set-Cookie` | n/a (no body) |
| `POST /auth/logout` | refresh cookie (optional) | — | 204, cookies cleared | n/a |
| `GET /auth/me` | access cookie | — | 200 `{ id, email }` | none |
| `DELETE /auth/me` | access cookie | `deleteAccountRequestSchema` | 204, cookies cleared | n/a |

**conversation-service** (contracts in `src/shared/contracts/{chat,http}.ts`, request bodies in `features/*/schema.ts`)

| Route | Auth | Request schema | Response (success) | Response schema today |
|---|---|---|---|---|
| `GET /health` | — | — | 200 `{ status: "ok" }` | none |
| `GET /metrics` | — | — | 200 Prometheus text | n/a |
| `GET /chats` | user JWT | — | 200 `{ chats: ChatDto[] }` | `chatDtoSchema` (no wrapper) |
| `POST /chats` | user JWT | `createChatSchema` | 201 `{ chat }` | `chatDtoSchema` |
| `GET /chats/:id` | user JWT | `chatIdParamsSchema` | 200 `{ chat }` | `chatDtoSchema` |
| `PATCH /chats/:id` | user JWT (owner) | `chatIdParamsSchema`, `updateChatSchema` | 200 `{ chat }` | `chatDtoSchema` |
| `DELETE /chats/:id` | user JWT (owner) | `chatIdParamsSchema` | 204 | n/a |
| `GET /chats/:id/members` | user JWT | `chatIdParamsSchema` | 200 `{ members: ChatMemberDto[] }` | `chatMemberDtoSchema` |
| `POST /chats/:id/members` | user JWT (owner) | `chatIdParamsSchema`, `addMemberSchema` | 201 `{ member }` | `chatMemberDtoSchema` |
| `DELETE /chats/:id/members/:email` | user JWT (owner) | `memberParamsSchema` | 204 | n/a |
| `DELETE /chats/:id/membership` | user JWT (member) | `chatIdParamsSchema` | 204 | n/a |
| `GET /chats/:chatId/messages` | user JWT | `chatParamsSchema` | 200 `{ messages: MessageDto[] }` | `messageDtoSchema` |
| `POST /chats/:chatId/messages` | user JWT + optional `X-Llm-Api-Key` | `chatParamsSchema`, `sendMessageSchema` | 201 `{ message }` | `messageDtoSchema` |
| `PATCH /chats/:chatId/messages/:messageId` | user JWT | `messageParamsSchema`, `editMessageSchema` | 200 `{ message }` | `messageDtoSchema` |
| `DELETE /chats/:chatId/messages/:messageId` | user JWT | `messageParamsSchema` | 204 | n/a |
| `POST /chats/:chatId/messages/:messageId/retry` | user JWT + optional `X-Llm-Api-Key` | `messageParamsSchema` | 202 `{ message }` | `messageDtoSchema` |
| `POST /chats/:chatId/stop` | user JWT | `chatParamsSchema` | 200 `{ stopped: boolean }` | none |
| `GET /chats/:chatId/stream` | user JWT | inline `paramsSchema` | 200 `text/event-stream` | `Sse*EventSchema` per event (US6) |
| `POST /chats/:chatId/messages/:messageId/attachments` | user JWT | `attachmentParamsSchema` + multipart `file` | 201 `{ attachment }` | `attachmentDtoSchema` |
| `POST /internal/erasures` | service token | `eraseUserSchema` | 200 `{ erased: { chats, memberships, messages, files } }` | none |
| `POST /internal/sessions/:userId/stop` | service token | inline `paramsSchema` | 200 `{ stopped: number }` | none |

Every error, in both services, uses the same envelope, `errorResponseSchema`:
`{ error: { code, message, fieldErrors? }, correlationId? }`. The two copies are identical.

**What the inventory found.**

1. **Responses are not described.** No route has a schema for its whole response body. The DTOs exist (`chatDtoSchema`,
   `messageDtoSchema`, …), but not the `{ chat }`, `{ messages }` wrappers, and five responses have no schema at all
   (`/health`, `{ stopped: boolean }`, `{ stopped: number }`, `{ erased }`, and auth's `{ id, email }`).
2. **auth-service's response schema is wrong.** `authResponseSchema` (`{ user: { id, email, createdAt } }`) is used only
   by its own unit test; register, login and `GET /me` return `{ id, email }`. The AICHAT-11 pacts
   (`pacts/mfe-auth-auth-service.json`) already lock `{ id, email }` in, so the schema is what has to change, not the API.
3. **Request schemas are not strict.** `z.object()` drops unknown keys without an error, so a body with an extra field
   is accepted today. US4 decides what to do with it.
4. **Login answers 401, not 400, for an invalid body.** That is on purpose (AC-36: never say which field was wrong);
   US4 treats it as an exception to "400 with field errors".

**Drift with `packages/shared-types`.** The analysis said only mfe-settings uses shared-types. That is no longer true:
mfe-chat and conversation-service depend on it too, but **only for `api-keys` and `model-capabilities`**. Neither
service imports its API DTOs from there. We compared every pair of schemas as JSON Schema (`z.toJSONSchema`):

| Schema | auth-service / conversation-service vs shared-types |
|---|---|
| Register, login, user profile, error envelope, add member | identical |
| Create / update chat body | service caps `model` at 200 characters |
| Send / edit message body | service caps `content` at 32 000 characters and `attachmentIds` at 10 |
| `ChatDto`, `ChatMemberDto` | service has `ownerEmail`; shared-types requires ISO date-times and title length |
| `MessageDto` | **incompatible**: different `status` values (`sent` vs `complete`/`canceled`), `attachments` objects vs `attachmentIds`, no `authorId`, `authorEmail`, `error`, `stopped` in shared-types |
| `AttachmentDto` | **incompatible**: shared-types has `ownerId`, `storedPath`, `extractedTextStatus`; the service has `filename`, `kind` |
| SSE events | shared-types has no `started` and no `message` event (handled in US6, with the AICHAT-20 guard) |

The shared-types chat DTOs describe an early design; the services describe what the API really sends.

**Decision (source of truth).** Each service's `src/shared/contracts` and feature `schema.ts` files are the single
source of truth for its API. US2 registers them in an OpenAPI registry and adds the missing response schemas there.
`packages/shared-types` is not the source for the HTTP API; its chat DTOs are left as they are, and the drift is pinned
by a test so it cannot change silently. Decided by João Vieira (epic owner) in the DoR review; the service owners
review it in the pull request.

| Owner | Responsibility |
|---|---|
| auth-service team | `services/auth-service/src/shared/contracts` and the generated auth spec |
| conversation-service team | `services/conversation-service/src/shared/contracts`, `features/*/schema.ts` and its spec |
| platform team | `packages/shared-types`: aligning or removing the stale chat DTOs is a follow-up, outside this epic |

**Files.**
- `services/conversation-service/src/shared/contracts/shared-types-drift.spec.ts` (new): for nine pairs of schemas,
  lists the fields that differ between the service and `@app/shared-types` and compares the list with `KNOWN_DRIFT`.
- `docs/AICHAT-12/WORKLOG.md` (this section): inventory, drift and decision.

**How to run.**

```sh
cd services/conversation-service && pnpm exec vitest run src/shared/contracts/shared-types-drift.spec.ts --reporter=verbose
```

**How to repeat it manually.**

1. Open `services/conversation-service/src/shared/contracts/chat.ts` and comment out `stopped: z.boolean(),` in
   `messageDtoSchema`.
2. Run the command above.
3. Expected output: `MessageDto matches the recorded drift` fails; the diff shows `"stopped: only in service"` missing.
   Restore the line.

**Result.** The guard passes with the recorded drift and fails as soon as a DTO changes on either side.

![Drift guard fails when a field is removed](evidence/01-drift-guard-red.png)

![Drift guard passes](evidence/02-drift-guard-green.png)

**Problems and fixes.** The first comparison script ran as CommonJS and failed on top-level `await`; we moved the
comparison into a Vitest test inside conversation-service, which already depends on `@app/shared-types`, so it runs
in CI with no extra tool. auth-service does not depend on shared-types, so its three request schemas were compared once
(identical) and are not guarded.

## 4. How to run everything

```sh
# filled in at the end of the epic
```

## 5. Results

| Metric | Before | After |
|---|---|---|

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|

## 7. Notes for the report
