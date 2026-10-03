---
title: "AICHAT-23 · [Foundations] Integration testing"
---

# AICHAT-23 · [Foundations] Integration testing

| Field | Value |
|---|---|
| Jira | [AICHAT-23](https://ipca-grupo11.atlassian.net/browse/AICHAT-23) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-34 (coverage), unassigned "Authorization / IDOR testing" (overlaps the 403/404 paths) |
| Layer | Backend HTTP routes (Express) |

## 1. Goal

Test **every Express route** of `auth-service` and `conversation-service` through HTTP with **supertest**, using
**fake repositories** instead of Postgres, **including the error paths** (400, 401, 403/404, 409, 422, 500).

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** The 24 routes in §4.2 and their error paths confirmed in scope
- [ ] **Tooling agreed:** Vitest + supertest + in-memory fakes confirmed; `createApp` dependency-injection approach agreed with the service owners
- [ ] Target environment available
- [ ] Fake repositories available for each service → **partly: conversation-service yes, auth-service no (§4.3)**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Every Express route tested with supertest and fake repositories, including error paths

## 3. Technologies

| Tool | Version | Role |
|---|---|---|
| Vitest | `5.0.1` | Runner (node environment) |
| supertest | `^7.2.1` | HTTP assertions against the Express app without opening a port |
| Express | `^4.22` | System under test |
| Zod | `^4.6` | Request validation (the source of 400s) |
| In-memory fakes | `services/conversation-service/src/test-utils/*` | `FakeChatsRepository`, `FakeMessagesRepository`, `FakeAttachmentsRepository`, `FakeStorage` |
| jsonwebtoken | `^9` | Signing test tokens (`test-utils/principal.ts` `asUser`) |

Out of scope here (other epics or unassigned): real Postgres (Testcontainers, used in AICHAT-33), contract tests (AICHAT-11).

## 4. Discovery: current state

### 4.1 How the apps are built for tests
- **conversation-service:** `createApp(prisma, env, logger)` (`src/app.ts:23`) builds repositories, `createProviderRegistry()` (line 43) and file storage (line 46) **inside**, so fakes cannot be injected into the full app. Each feature's `routes.spec.ts` instead builds a small Express app around one router with fake-backed services. `app.spec.ts` only checks `/health`, `/metrics`, 401 and the correlation id.
- **auth-service:** `createApp()` (`src/main.ts:24`) takes no arguments; routers import a **singleton `prisma`**. Specs use `vi.mock("../../shared/prisma")` with `fakePrisma()` (`features/session/test-fakes.ts`). **There is no repository layer**.

### 4.2 Route inventory and error-path gaps

| Route | Tested in | Covered | **Missing** |
|---|---|---|---|
| GET /health, /metrics (auth) | `main.spec.ts` | 200, labels | — |
| POST /auth/register | `register/api.spec.ts`, `register-then-login.spec.ts` | 201, 400, 409 | 500 |
| POST /auth/login | `session/api.spec.ts` | 200 + cookies, 401 unknown/wrong password | 400/401 malformed body, 500 |
| POST /auth/refresh | same | 204, 401 missing, 401 reused | expired token |
| POST /auth/logout | same | 204, refresh fails after | no cookie |
| GET /auth/me | same | 200, 401 none/garbage | 401 deleted user (`api.ts:78`) |
| GET /health, /metrics (conv) | `app.spec.ts`, `metrics.spec.ts` | 200 | — |
| GET /chats | `chats/routes.spec.ts` | 200, 401 | — |
| POST /chats | same | 201, 400 | — |
| GET /chats/:id | same | 200, 403/404, 404 after delete | — |
| PATCH /chats/:id | same | 200 | 400 empty body, non-owner 404 |
| DELETE /chats/:id | same | 204, cross-user | — |
| GET /chats/:id/members | same | 200 guest | non-member 404 |
| POST /chats/:id/members | same | 201, 400 bad email | 400 `CANNOT_INVITE_SELF` (`chats/service.ts:167`), 409 `ALREADY_A_MEMBER` (:171), non-owner |
| DELETE /chats/:id/members/:email | same | happy path | 403 `FORBIDDEN` (:182), 404 `MEMBER_NOT_FOUND` (:186) |
| DELETE /chats/:id/membership | same | happy path | not a member |
| GET /chats/:chatId/messages | `messages/routes.spec.ts` | 200, 401 | cross-user |
| POST /chats/:chatId/messages | same | 201, cross-user | 400 validation |
| PATCH …/messages/:messageId | same | 200 | 409 `MESSAGE_NOT_EDITABLE` (`messages/service.ts:161`), 404, 400 |
| DELETE …/messages/:messageId | same | 204 | 409 `MESSAGE_NOT_CANCELABLE` (:172) |
| POST …/messages/:messageId/retry | same | 202 | 409 `MESSAGE_NOT_RETRYABLE` (:191), 404 (:209) |
| POST /chats/:chatId/stop | same | 200 | cross-user |
| GET /chats/:chatId/stream (SSE) | `streaming/routes.spec.ts` | 401, 403/404, delivery, active-stream gauge | — |
| POST …/messages/:messageId/attachments | `attachments/routes.spec.ts` | 201, 401, 400 no file / bad type | 404 `MESSAGE_NOT_FOUND`, 422 no-vision, cross-user, multer size limit (413) |

**500s** are only tested in the error-handler unit tests (`conversation-service/src/shared/error-handler.spec.ts:44`, `auth-service/src/shared/error-middleware.spec.ts:59`), never through a route.

Totals: **24 routes, all with at least one supertest test; ~25 error paths missing**.

### 4.3 Fakes
- conversation-service: fakes for chats, messages, attachments, storage. **Missing:** a reusable fake `LlmProvider`/`ProviderRegistry` (an inline one exists in `attachments/routes.spec.ts`) and a fake `QueueManager`.
- auth-service: `fakePrisma()` stands in for the Prisma client; a second inline copy exists in `register-then-login.spec.ts`. No repository interfaces.

## 5. Implementation plan (steps)

1. Agree on the "error path" list per route (table above = proposal).
2. **Testability seam (needs agreement, as it touches app code):** let `createApp` accept optional overrides (`{ repositories?, providers?, storage?, queue? }`) so one full-app supertest suite can run with fakes and real middleware order (auth → correlation → routes → error handler). Without this, keep the per-router approach.
3. Move the inline fakes into `test-utils/` (`fake-provider-registry.ts`, `fake-queue.ts`); in auth-service, merge the two `fakePrisma` copies.
4. Add a `throwingRepository()` helper so any route can be made to fail with an unexpected error → assert **500 with the standard error body and no stack trace leak**.
5. Fill in the missing error paths, one `describe` per route: `happy`, `validation (400)`, `unauthenticated (401)`, `not yours (403/404)`, `conflict (409/422)`, `unexpected (500)`.
6. Add a **route-inventory guard test**: walk `app._router.stack`, list every method + path, and fail if a route has no entry in a `ROUTE_TESTS` map. New routes then can't be added without tests.
7. Docs: how to run (`pnpm exec nx run conversation-service:test`), how fakes work.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-40](https://ipca-grupo11.atlassian.net/browse/AICHAT-40) | AICHAT-23-US1 | As a developer, I want shared fakes (provider registry, queue, Prisma) so that route tests don't redefine them | Fakes in `test-utils`; duplicates removed | 2 |
| [AICHAT-57](https://ipca-grupo11.atlassian.net/browse/AICHAT-57) | AICHAT-23-US2 | As a developer, I want the full conversation-service app testable with fakes so that middleware order is exercised | `createApp` overrides (agreed with the service owner); one full-app suite runs every route | 3 |
| [AICHAT-76](https://ipca-grupo11.atlassian.net/browse/AICHAT-76) | AICHAT-23-US3 | As a user, I want clear 4xx errors for invalid membership operations | Tests for `CANNOT_INVITE_SELF`, `ALREADY_A_MEMBER`, `FORBIDDEN`, `MEMBER_NOT_FOUND`, not-a-member, non-owner | 3 |
| [AICHAT-93](https://ipca-grupo11.atlassian.net/browse/AICHAT-93) | AICHAT-23-US4 | As a user, I want message edit/cancel/retry to refuse invalid states | 409 `MESSAGE_NOT_EDITABLE/CANCELABLE/RETRYABLE`, 404 and 400 tested | 3 |
| [AICHAT-111](https://ipca-grupo11.atlassian.net/browse/AICHAT-111) | AICHAT-23-US5 | As a user, I want attachment uploads to fail clearly | 404, 422 no-vision, cross-user, 413 size limit tested | 2 |
| [AICHAT-125](https://ipca-grupo11.atlassian.net/browse/AICHAT-125) | AICHAT-23-US6 | As an operator, I want unexpected errors to return a safe 500 | One 500 test per router in both services; no stack trace in the body | 2 |
| [AICHAT-131](https://ipca-grupo11.atlassian.net/browse/AICHAT-131) | AICHAT-23-US7 | As a team, I want a guard that fails when a route has no test | Route-inventory test in both services | 2 |
| [AICHAT-134](https://ipca-grupo11.atlassian.net/browse/AICHAT-134) | AICHAT-23-US8 | As a developer, I want auth-service edge cases tested | expired refresh, logout without cookie, `/me` for a deleted user, malformed login body | 2 |

## 7. Risks and open decisions

- US2 needs a small change to `createApp` (dependency injection). It is a testability refactor, so it must be agreed with the service owners.
- Some cross-user cases overlap the unassigned **Authorization / IDOR** test type (the #1 suggested priority in `TEST-TYPES.md`). Recommendation: this epic covers one IDOR case per route; a dedicated IDOR epic should cover the full matrix.

## 8. Notes for the report

Every one of the 24 routes already has at least one supertest test, so the **integration layer exists and is
healthy**. Discovery found about **25 untested error paths** (mainly 409/422 business-rule conflicts, and 500s
never tested through a route) and a **testability limit**: `createApp` builds its own dependencies, and auth-service has no
repository layer. The plan adds the error paths, shared fakes and a route-inventory guard so new routes can't skip tests.
