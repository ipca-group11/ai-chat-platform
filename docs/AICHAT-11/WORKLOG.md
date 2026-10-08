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

### US2 · Consumer pacts: mfe-auth, shell and mfe-settings to auth-service ([AICHAT-178](https://ipca-grupo11.atlassian.net/browse/AICHAT-178))

**What and why.** Each frontend that calls auth-service now writes down, in a pact file, exactly which requests it sends
and which parts of the responses it relies on. The tests call the real client functions (`features/*/api/*.ts`,
`shared/auth.ts`); only the network underneath is the Pact mock server, which answers declared requests and rejects any
other. mfe-chat's `GET /auth/me` (pair 4 of US1) is included because its provider is auth-service.

**How a consumer test works.**

1. `newConsumerPact("mfe-auth", "auth-service")` creates the Pact for one pair; the file is `pacts/mfe-auth-auth-service.json`
   at the repository root, whichever app runs the test (`pactDir()`).
2. Each test declares one interaction: provider state (`given`), description, the exact request, and the response
   with **matchers**: `like("user-1")` means "any string", so the provider is not tied to the example values.
3. `runWithMockServer(pact, () => fetchMe())` starts the mock server, points the global `fetch` at it (the clients use
   relative URLs, as in the browser) and runs the real function.
4. The test asserts what the client does with the answer (returns the user, throws `ApiError` 401 with the server's
   message, `fetchSession` returns `null` on 401).
5. Pact checks that every declared request arrived exactly as declared, and only then writes the interaction.

Cookies are not part of the contract: the browser adds them, and auth-service's verifier adds valid ones for each
provider state (US4). The correlation id is required in both directions (`correlationHeaderMatcher()`), error bodies use
`errorResponseMatcher()` / `fieldErrorsMatcher()`.

**Files.**
- `packages/pact-config/consumer.ts` (new): `pactDir`, `newConsumerPact`, `removePacts`, `routeFetchTo`, `runWithMockServer`; unit tests in `consumer.spec.ts`.
- `apps/{mfe-auth,shell,mfe-settings,mfe-chat}/vitest.pact.config.ts` + `vitest.pact.setup.ts` (new): Node environment, no MSW, one file at a time, old pact files removed at start.
- `apps/*/vite.config.ts`: the normal test run excludes `*.pact.spec.ts`.
- `apps/*/project.json`: new Nx target `pact:consumer`.
- `apps/mfe-auth/src/features/{login,register}/api/*.pact.spec.ts` (new): 10 interactions.
- `apps/shell/src/features/auth-guard/api/auth.pact.spec.ts` (new), `logout.ts` (new, logout moved out of `AppShellLayout`), `useSession.ts` (`fetchSession` exported).
- `apps/mfe-settings/src/features/api-keys/api/auth.pact.spec.ts`, `apps/mfe-chat/src/shared/auth.pact.spec.ts` (new).
- `apps/mfe-auth/src/shared/api-client.ts`: reads the real error envelope (defect below); 16 MSW doubles in mfe-auth's specs now answer with that envelope.
- `.gitignore`: `pacts/` (generated, shared as a CI artifact).

**How to run.**

```sh
pnpm exec nx run-many -t pact:consumer -p mfe-auth shell mfe-settings mfe-chat
ls pacts/   # mfe-auth-auth-service.json, shell-auth-service.json, mfe-settings-…, mfe-chat-…
```

**How to repeat it manually.**

1. Run the command above; expected: every test passes and four `*-auth-service.json` files appear in `pacts/`.
2. Open `pacts/mfe-auth-auth-service.json`: each interaction has `providerStates`, `request`, `response` and
   `matchingRules` (`"match": "type"` for every `like`).
3. Break the client: change `"/auth/login"` to `"/auth/signin"` in `apps/mfe-auth/src/features/login/api/login.ts` and
   run `pnpm exec nx run mfe-auth:pact:consumer`. Expected: the two login tests fail with "request was not expected" /
   "expected but not received". Restore the line.

**Result.** 17 interactions in 4 pact files, using 4 provider states that auth-service has to support:
`a user exists` (`email`, `password`), `a user is logged in` (`email`), `a user has a valid refresh token` (`email`),
`no user exists with the email` (`email`), `no user is logged in`.

![Four consumer pacts for auth-service](evidence/04-auth-consumer-pacts.png)

A broken path fails the consumer test:

![Changing the login path fails the pact test](evidence/03-mfe-auth-broken-path.png)

**Defect found: the server's error message never reached the user.** auth-service answers every error with
`{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }`. mfe-auth's `extractErrorMessage`
only read `error` when it was a **string** or a top-level `message`, shapes the server never sends, so the forms showed the
HTTP status text ("Unauthorized", or "Request failed" over HTTP/2 where there is no status text). The 16 MSW doubles in
mfe-auth's tests had been written with those same wrong shapes, so every test passed. The pact test, whose mock answers
with the shared error envelope, failed first:

![Before the fix: the 401 message is the status text](evidence/02-mfe-auth-error-message-red.png)

The client now reads `error.message`, and the doubles use the real envelope. The shell and mfe-chat do not show the
server's message (they use their own text), so they were not affected.

**Problems and fixes.**
- Pact writes an interaction only when the test callback **resolves**. Clients that throw on a 401 made Pact drop every
  error interaction silently (the first run wrote 5 of 10). `runWithMockServer` now captures the client's outcome inside
  the callback and replays it afterwards; a unit test covers it.
- Vitest loads `vitest.*.config.ts` with plain Node, which cannot resolve pact-config's `.js` imports of `.ts` sources.
  The cleanup moved to a `globalSetup` file, which Vitest transforms.
- `PACT_LOG_LEVEL` allows `fatal`, which `PactV3` does not accept; `newConsumerPact` maps it to `error`.
- `consumerName()` forces the `mfe-` prefix; `newConsumerPact` takes the names as given (`shell`, `auth-service`).
