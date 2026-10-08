---
title: "AICHAT-11 · Consumer-driven contract testing: work log"
---

# AICHAT-11 · Consumer-driven contract testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-11](https://ipca-grupo11.atlassian.net/browse/AICHAT-11) |
| Analysis | [README.md](README.md) |
| Owner | João Vieira |
| Branch | `test/AICHAT-11-contract-testing` (built on `test/AICHAT-15-stream-cancellation`, which has the Stop fix) |
| Started / finished | 2026-10-08 / … |
| Pull requests | … |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-08

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | João Vieira | — |
| Scope and tooling agreed | Met | How are the contract tests built? | Pact JS V3 (`PactV3`) consumer tests in Vitest that drive the real client code; provider verification with the Pact `Verifier` against the Express app started in-process with in-memory fakes | João Vieira |
| Target environment available | Met | — | CI only. No running stack, no Docker, no database | — |
| `packages/pact-config` set up | Met | — | Exists (`pact.config.ts`, `matchers.ts`, unit-tested). No app or service uses it yet | — |
| Consumer/provider pairs listed | Met | Which pairs are in scope? | All 7 pairs found in the code (table below). SSE (`GET /chats/:chatId/stream`) is out of scope for Pact | João Vieira |

Decisions:

| Topic | Decision |
|---|---|
| Pairs | The README draft plus three pairs found in the code: mfe-settings → conversation-service (test connection), mfe-chat → auth-service (`GET /auth/me`) and auth-service → conversation-service (`POST /internal/erasures`, `POST /internal/sessions/:userId/stop`) |
| Pact sharing | CI artifacts inside one workflow run: the consumer job uploads `pacts/`, the provider jobs download it. No Pact Broker |
| Stop route | Already fixed by AICHAT-199 (the client calls `POST /chats/:chatId/stop`). The pact uses the fixed client. As "before" evidence we point the client at the old path once and show provider verification failing. The AICHAT-179 criterion in Jira is updated to reference AICHAT-199 |

Blockers: none.

## 2. Environment

![Environment](evidence/00-environment.png)

| Tool | Version | Install |
|---|---|---|
| macOS | 27.0.1 | — |
| Node | v26.8.2 locally (CI uses Node 24 from `.nvmrc`) | nvm |
| pnpm | 10.4.0 (pinned in `package.json`) | `pnpm install --frozen-lockfile` |
| `@pact-foundation/pact` | 17.1.4 | dev dependency of each consumer and provider |
| Vitest | 5.0.1 | workspace dev dependency |

## 3. Steps

### US1 · List consumer/provider pairs and agree how pacts are shared ([AICHAT-177](https://ipca-grupo11.atlassian.net/browse/AICHAT-177))

**What and why.** A contract test only protects the calls it knows about. Before writing any pact we listed every HTTP
call from the real client code (not from the analysis draft) and compared each one with the routes the providers really
mount. The draft table missed three pairs, and the comparison found two calls that no provider route answers.

**Files.**
- `docs/AICHAT-11/WORKLOG.md` (this section): pairs, sharing decision, baseline.

**Consumer/provider pairs.** Paths as the provider sees them (the shell proxies `/auth/*` to auth-service and `/api/*`
to conversation-service).

| # | Consumer | Client file(s) | Provider | Calls |
|---|---|---|---|---|
| 1 | mfe-auth | `features/register/api/register.ts`, `features/login/api/{login,session}.ts`, `shared/api-client.ts` | auth-service | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me` |
| 2 | shell | `features/auth-guard/api/useSession.ts`, `shared/layout/AppShellLayout.tsx`, `shared/http/apiClient.ts` | auth-service | `GET /auth/me`, `POST /auth/logout` (the draft listed `/refresh`; the shell never calls it) |
| 3 | mfe-settings | `features/api-keys/api/auth.ts` | auth-service | `GET /auth/me` |
| 4 | mfe-chat | `shared/auth.ts` | auth-service | `GET /auth/me` (missing from the draft) |
| 5 | mfe-chat | `features/chat-list/api/chats.ts` | conversation-service | `GET /chats`, `POST /chats`, `GET /chats/:id`, `PATCH /chats/:id`, `DELETE /chats/:id` |
| | | `features/chat-members/api/members.ts` | | `GET /chats/:id/members`, `POST /chats/:id/members`, `DELETE /chats/:id/members/:email`, `DELETE /chats/:id/membership` |
| | | `features/chat-view/api/messages.ts` | | `GET /chats/:id/messages`, `POST /chats/:id/messages`, `PATCH /chats/:id/messages/:messageId` (edit), `DELETE /chats/:id/messages/:messageId` (cancel), `POST /chats/:id/messages/:messageId/retry`, `POST /chats/:id/stop` |
| | | `features/attachments/api/useUploadAttachment.ts` | | `POST /chats/:id/attachments` (multipart) — **no such route, AICHAT-255** |
| 6 | mfe-settings | `features/api-keys/api/testConnection.ts` | conversation-service | `POST /providers/:provider/test-connection` — **no such route, AICHAT-256** (missing from the draft) |
| 7 | auth-service | `shared/erasure-client.ts`, `shared/reply-stop-client.ts` | conversation-service | `POST /internal/erasures`, `POST /internal/sessions/:userId/stop` (service token; missing from the draft) |

Out of scope: `GET /chats/:id/stream` (SSE is a long-lived event stream, not request/response; its events are checked by
AICHAT-12-US6) and `DELETE /auth/me` (no frontend calls it yet; it is covered by auth-service's integration tests).

**Defects found while listing.** Both follow the pattern of the Stop bug (AICHAT-199): the frontend test doubles copy the
client path, so the tests pass while the real call gets 404.

| Jira | Client calls | Provider has |
|---|---|---|
| [AICHAT-255](https://ipca-grupo11.atlassian.net/browse/AICHAT-255) | `POST /chats/:id/attachments`, before the message exists, then sends `attachmentIds` | only `POST /chats/:id/messages/:messageId/attachments`; `attachmentIds` is accepted on send but never read |
| [AICHAT-256](https://ipca-grupo11.atlassian.net/browse/AICHAT-256) | `POST /providers/:provider/test-connection` | no `/providers` route at all (only the mock server answers it) |

Decision: the pacts describe what the client really sends. Provider verification keeps these interactions in an explicit
known-failure list keyed by the bug, and the verifier fails if one of them starts passing, so the list cannot go stale
once a bug is fixed.

**How pacts are shared.** CI artifacts inside one workflow run: the consumer job writes `pacts/*.json` and uploads them;
the provider jobs download them and verify. No Pact Broker: everything lives in one repository and one pipeline, so the
broker's versioning and `can-i-deploy` would add an account and secrets without adding protection.

**Baseline.** `packages/pact-config` exists (shared `PACT_DIR`, naming helpers and matchers, unit-tested), but it is the
only package depending on `@pact-foundation/pact`, and no pact file exists.

![Baseline: only pact-config depends on Pact, no pact files](evidence/01-baseline.png)

**How to repeat it manually.**

1. List the client calls: `grep -rnE "apiClient\.(get|post|patch|delete)|apiFetch|fetch\(" apps/*/src --include='*.ts' | grep -v test`.
2. List the provider routes: `grep -rnE "router\.(get|post|patch|delete)\(" services/*/src --include='*.ts' | grep -v spec`
   and the mount points (`app.use("/chats", …)`) in `services/conversation-service/src/app.ts` and `services/auth-service/src/main.ts`.
3. Expected: every client call has a matching route, except the two rows in the defects table.

**Problems and fixes.** `consumerName()` in `pact-config` always adds the `mfe-` prefix, which is wrong for the shell and
for auth-service as a consumer. Those two pacts pass their names directly.
