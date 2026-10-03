### US9 · auth-service API mock ([AICHAT-155](https://ipca-grupo11.atlassian.net/browse/AICHAT-155))

**What and why.** The `auth` mock answers the four calls the apps make to auth-service, plus `refresh` (the login app calls it too): `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` and `POST /auth/refresh`. The mount path is `/auth`, the same path the shell proxy and the apps use, so a frontend only needs the mock's host. The session is kept in two cookies with the same names and attributes as the real service (`access_token` on `/`, 15 minutes, and `refresh_token` on `/auth`, 7 days; both `HttpOnly` and `SameSite=Lax`). The value is an opaque id instead of a JWT, and the conversation mock reads the same sessions, so one login works for both. Users come from the loaded dataset (`default` has `alice@mock.test` and `bob@mock.test`, password `Mock-pass-1234`; `empty` has none, so register first). A user registered through the mock is added to the dataset and disappears on `/__admin/reset`.

The responses follow the real routes in `services/auth-service`: register answers `201 {id, email}` (no cookie), login `200 {id, email}` with the cookies, logout `204` and cleared cookies, me `200 {id, email}`. Errors have the shared body `{error: {code, message, fieldErrors?}, correlationId}`: `VALIDATION_ERROR` (400, field errors from the shared password policy), `EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` (401, the same answer for an unknown email, a wrong password or a bad body), `UNAUTHENTICATED` (401) and `INVALID_REFRESH_TOKEN` (401). The request schemas are the ones from `@app/shared-types`, so the mock and the apps cannot drift apart.

**Files.**
- `testing/mock-server/src/routers/auth.router.ts`: the routes and the cookie handling.
- `testing/mock-server/src/auth/sessions.ts`: open sessions, shared with the conversation mock.
- `testing/mock-server/src/backend/http.ts`: error body, correlation id, cookie parsing and CORS (with credentials) shared by both backend mocks.
- `testing/mock-server/src/routers/auth.router.spec.ts`: tests; the responses are parsed with the zod schemas of `@app/shared-types` (`auth.userProfileSchema`, `http.errorResponseSchema`).

**How to run.**

```sh
pnpm exec nx test mock-server
MOCK_DATASET=default pnpm exec nx serve mock-server     # http://localhost:4010
```

**How to repeat it manually.**

1. Start the server as above.
2. Register, log in with a cookie jar and read the session:
   `curl -c jar -X POST localhost:4010/auth/login -H 'content-type: application/json' -d '{"email":"alice@mock.test","password":"Mock-pass-1234"}'`, then `curl -b jar localhost:4010/auth/me`.
3. Expected output: `{"id":"user_00001","email":"alice@mock.test"}` for both, two `Set-Cookie` headers on login, `204` on `POST /auth/logout` and `401 UNAUTHENTICATED` on `/auth/me` afterwards. A weak password on register gives `400 VALIDATION_ERROR` with `fieldErrors.password`.

**Result.** The curl flow below goes through register (201), a validation error, a duplicate email (409), a wrong password (401), login with cookies, `me`, logout and `me` again (401). The test run is in the US11 section.

![Register, login, me and logout with curl](evidence/31-auth-curl-flow.png)

**Problems and fixes.** The real service signs a JWT and keeps hashed refresh tokens in the database; the mock keeps a map of open sessions in memory, which is enough because the apps never read the token. Logout in the real service only revokes the refresh token; the mock closes the whole session, so `me` fails right after logout, which is what the apps expect.

### US10 · conversation-service API mock, with the chat SSE stream ([AICHAT-156](https://ipca-grupo11.atlassian.net/browse/AICHAT-156))

**What and why.** The `conversation` mock is mounted on `/api`, the base path of the chat and settings apps (the shell proxy removes `/api` before the real service sees `/chats`, so the mock keeps it). Every call needs the session of the auth mock (cookie `access_token` or a Bearer header, as in the real service) and answers `401 UNAUTHENTICATED` otherwise. Chats and messages are stateful in memory and live in the loaded dataset, so `/__admin/seed/<dataset>` and `/__admin/reset` replace them; members, attachments and the provider key test are answered from the seed data.

| Area | Routes (all under `/api`) |
|---|---|
| Chats | `GET /chats`, `POST /chats`, `GET\|PATCH\|DELETE /chats/:id` |
| Members | `GET\|POST /chats/:id/members`, `DELETE /chats/:id/members/:email`, `DELETE /chats/:id/membership` |
| Messages | `GET\|POST /chats/:chatId/messages`, `PATCH\|DELETE /chats/:chatId/messages/:messageId` (edit, cancel), `POST .../:messageId/retry`, `POST /chats/:chatId/stop` and `POST .../:messageId/stop` |
| Stream | `GET /chats/:chatId/stream` (Server-Sent Events) |
| Attachments | `POST /chats/:chatId/messages/:messageId/attachments`, `POST /chats/:chatId/attachments` (multipart, `attachmentIds` links them to the next message) |
| Provider keys | `POST /providers/:provider/test-connection` (key in `X-Llm-Api-Key`: any key works, `invalid...` is rejected, none gives a failure message) |

Sending a message answers `201` with the user message, then the chat answers like the real queue: one answer at a time, a message sent while another streams is `queued` and can be edited (`PATCH`) or canceled (`DELETE`, `204`) until it starts (`409 MESSAGE_NOT_EDITABLE` / `MESSAGE_NOT_CANCELABLE` after that), `stop` ends the streaming answer and keeps the text so far, and a failed answer is retried with `POST .../retry` (`202`, `409 MESSAGE_NOT_RETRYABLE` for any other message). The stream sends the events of the real service as `event: <type>` and `data: {...}`: `message`, `queued`, `started`, `token`, `reasoning`, `web_fetch`, `done` (with `stopped`) and `error` (with `retryable`). Chats with reasoning or web fetch turned on also send those events. Chats are visible to their owner and to invited members; anything else is `404 CHAT_NOT_FOUND`. Timing comes from `TTFT_MS`, `TOKEN_INTERVAL_MS` and `TOKENS`.

The text of an answer comes from `src/conversation/answer-text.ts` (`answerText(scenario, ctx)` returns the tokens, seeded by `SEED`). It is a small local stand-in until the LLM scenarios exist; the scenario is chosen with `X-Mock-Scenario` on the send or retry request: `ok` (default), `long` (five times as long) and `error` (fails after two tokens, so the message ends as `failed` and can be retried).

**Files.**
- `testing/mock-server/src/routers/conversation.router.ts`: all the routes.
- `testing/mock-server/src/conversation/engine.ts`: the per-chat queue, the streaming of an answer, stop and reset.
- `testing/mock-server/src/conversation/records.ts`: access rules, id generation and the mapping from the dataset records to the service's DTOs.
- `testing/mock-server/src/conversation/contract.ts`: request schemas and response DTO schemas of the real service.
- `testing/mock-server/src/conversation/answer-text.ts`: the answer text adapter.
- `testing/mock-server/src/routers/conversation.router.spec.ts`: tests, including a real SSE connection.

**How to run.**

```sh
pnpm exec nx test mock-server
MOCK_DATASET=default TTFT_MS=100 TOKEN_INTERVAL_MS=40 pnpm exec nx serve mock-server
```

**How to repeat it manually.**

1. Start the server, log in with a cookie jar (`curl -c jar -X POST localhost:4010/auth/login -H 'content-type: application/json' -d '{"email":"alice@mock.test","password":"Mock-pass-1234"}'`).
2. Create a chat: `curl -b jar -X POST localhost:4010/api/chats -H 'content-type: application/json' -d '{"title":"Mock demo","provider":"anthropic","model":"claude-sonnet-5-5"}'`.
3. In a second terminal open the stream, `curl -N -b jar localhost:4010/api/chats/chat_00005/stream`, and send `curl -b jar -X POST localhost:4010/api/chats/chat_00005/messages -H 'content-type: application/json' -d '{"content":"Hello mock"}'`.
4. Expected output: `201` with the message, and on the stream `message`, `started`, one `token` event per word and `done`. For the queue send three messages quickly (`TTFT_MS=600` makes it easy), then edit and cancel the waiting ones; send with `-H 'X-Mock-Scenario: error'` and call `.../retry` on the failed answer.

**Result.** The first capture shows the stream while a message is sent: `message`, `started`, ten `token` events and `done`, and the saved history. The second shows the queue: the second message is edited, the third canceled, editing a message that already started is refused (409), an answer fails with the `error` scenario and the retry completes it.

![Create a chat, send a message and read the SSE stream](evidence/32-chat-send-and-stream.png)

![Queue, edit, cancel and retry](evidence/33-queue-edit-cancel-retry.png)

**Problems and fixes.** The records in `@app/shared-types` do not have the shape the service sends: the service adds author fields to messages, uses the status `sent` (the shared type says `complete`), sends attachments as objects and has the events `message` and `started`. The mock keeps the shared records in the dataset and maps them to the service's DTOs when it answers. Chat, member and error responses are checked against the shared schemas in the tests; the message, attachment and event DTOs are checked against schemas copied from `services/conversation-service/src/shared/contracts/chat.ts` (`contract.ts`). The chat app calls two paths that the service does not have (`POST /chats/:id/messages/:id/stop` and `POST /chats/:id/attachments`); the mock accepts both next to the real ones so the app works against it. Ids of canceled messages are never reused. The settings app's connection test (`/providers/:provider/test-connection`) is not implemented in the real service yet, so its answer is canned.

### US11 · Fault injection for the backend mocks ([AICHAT-157](https://ipca-grupo11.atlassian.net/browse/AICHAT-157))

**What and why.** Both backend mocks can fail on demand, so the apps' error paths can be tested. Four faults exist: `session-expired` (`401 UNAUTHENTICATED`; the auth mock also clears the session cookies), `error-500` (`500 INTERNAL_ERROR` with the message of the real service), `slow` (the answer is held back 3 s, or `delayMs` of the fault) and `stream-drop` (the chat stream is cut after three events, without ending the response). There are two ways to choose one. The header `X-Mock-Scenario: <fault>` applies to that request only. `POST /__admin/faults` with `{"route": "GET /auth/me", "scenario": "session-expired", "times": 1}` sets it per route for tests that cannot add headers (a browser): `route` is `METHOD /path` where the method can be `*`, `:name` stands for one path segment and a trailing `*` for the rest (`GET /api/chats/:id/stream`, `* /api/*`), and the optional `times` limits it to that many requests ("401 on the next call"). `GET /__admin/faults` lists what is set (and the valid names), `DELETE /__admin/faults` clears everything (`?route=...` clears one) and `/__admin/reset` clears them too. A faulted response carries the header `X-Mock-Fault`. A header value that is not a fault name (for example the answer scenario `error`) is ignored by the fault layer. The faults are listed by `/__admin/scenarios` under `auth` and `conversation`.

**Files.**
- `testing/mock-server/src/faults/faults.ts`: the fault store, route matching, the middleware used by both routers and the `/__admin/faults` routes.
- `testing/mock-server/src/faults/faults.spec.ts`: tests for matching, the store, the admin endpoints and each fault on both mocks, including a cut stream.
- `testing/mock-server/src/admin/admin.router.ts`, `src/routers/auth.router.ts`, `src/routers/conversation.router.ts`: one line each to mount the routes and the middleware (and the stream drop in the stream route).

**How to run.**

```sh
pnpm exec nx run-many -t lint typecheck test build -p mock-server
```

**How to repeat it manually.**

1. Start the server and log in with a cookie jar as in US10.
2. One request by header: `curl -i -b jar -H 'X-Mock-Scenario: error-500' localhost:4010/api/chats`.
3. Per route: `curl -X POST localhost:4010/__admin/faults -H 'content-type: application/json' -d '{"route":"GET /auth/me","scenario":"session-expired","times":1}'`, then call `/auth/me` twice. Do the same with `slow` (`"delayMs":1500`) and with `stream-drop` on `GET /api/chats/:id/stream` while a stream is open and a message is sent.
4. Expected output: `500` with `X-Mock-Fault: error-500`; the first `/auth/me` gives `401 UNAUTHENTICATED` and the second `200`; the slow call takes about 1.5 s; the stream ends after the `message`, `started` and first `token` event (curl exits with 18). `curl -X POST localhost:4010/__admin/reset` and `GET /__admin/faults` shows `[]`.

**Result.** The fault flow shows each fault once, then the list and the reset. The test run passes lint, typecheck and 139 tests with coverage of 98.9% statements, 92.8% branches, 99.1% functions and 99.5% lines (thresholds are 80).

![Fault injection with curl](evidence/34-fault-injection.png)

![Mock server tests with coverage](evidence/30-backend-mocks-tests.png)

**Problems and fixes.** Ending the stream with `res.destroy()` dropped the last event that had just been written, so the drop now flushes the socket first and then closes it, without sending the end of the chunked body, which is what a real network cut looks like to the client. The fault layer sits in front of the routes of each mock, before authentication, so `session-expired` also works on routes that need a session. The faults and the answer scenarios share the header `X-Mock-Scenario`; names do not overlap (`error` is an answer scenario, `error-500` a fault).
