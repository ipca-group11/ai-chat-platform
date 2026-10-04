---
title: "AICHAT-12 · [Foundations] API schema validation testing"
---

# AICHAT-12 · [Foundations] API schema validation testing

| Field | Value |
|---|---|
| Jira | [AICHAT-12](https://ipca-grupo11.atlassian.net/browse/AICHAT-12) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Related | AICHAT-11 (contracts), AICHAT-20 (DTO snapshots, SSE drift), AICHAT-23 (integration tests) |
| Layer | Backend HTTP API: auth-service, conversation-service |

## 1. Goal

The **request and response of every route** are validated against one agreed Zod schema, an **OpenAPI spec** is generated from
those schemas, and **Schemathesis** fuzzes the running API from the spec in CI.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Zod → OpenAPI generator; supertest for per-route validation; Schemathesis Docker image
- [ ] Target environment available (unit level: none; Schemathesis: compose stack in CI)
- [ ] **Shared Zod schemas in `packages/shared-types` cover every route** → **not true today**, see §4.2; decided in US1

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Request and response of every route validated against the schemas
- [ ] Schemathesis run against the OpenAPI spec

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| Zod | `^4.6.5` | Schemas (services' `schema.ts` + `shared/contracts`, `packages/shared-types`) |
| `@asteasolutions/zod-to-openapi` (or equivalent for Zod 4) | — | Generate OpenAPI 3.1 from the schemas |
| supertest | `^7.2.1` | Call every route, parse bodies with the strict schema |
| Schemathesis | Docker image | Property-based API tests from the spec |
| Vitest | `5.0.1` | Runner |

## 4. Discovery: current state

### 4.1 Routes

| Service | Routes |
|---|---|
| auth-service | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` (+ `/health`, `/metrics`) |
| conversation-service | chats: `GET /`, `POST /`, `GET/PATCH/DELETE /:id`, `GET/POST /:id/members`, `DELETE /:id/members/:email`, `DELETE /:id/membership`; messages: `GET/POST /:chatId/messages`, `PATCH/DELETE /:chatId/messages/:messageId`, `POST .../:messageId/retry`, `POST /:chatId/stop`; attachments: `POST /:chatId/messages/:messageId/attachments`; streaming: `GET /:chatId/stream` (+ `/health`, `/metrics`) |

### 4.2 Where the schemas live

- `packages/shared-types` (`@app/shared-types`): auth DTOs, chat, message, attachment, SSE, error response, correlation id,
  api-keys. **Only `apps/mfe-settings` depends on it.**
- auth-service: `src/shared/contracts/{auth,http}.ts`; conversation-service: `src/shared/contracts/{auth,chat,http}.ts` and
  per-feature `schema.ts`. These are **separate copies**, so drift is possible (JP's AICHAT-20 already reports SSE drift
  between mfe-chat and shared-types).
- No OpenAPI / Swagger spec anywhere in the repo.

### 4.3 Validation today

Requests are parsed with Zod in controllers/routes (e.g. `paramsSchema.parse` in `streaming/routes.ts`); errors go through the
shared error handler with the `{ error: { code, message, fieldErrors? } }` envelope. **Responses are not validated.**

## 5. Implementation plan (steps)

1. US1: route ↔ schema table; decide the source of truth (move to shared-types, or keep service contracts and export them).
2. Register every route's request/response schema in an OpenAPI registry per service; script `openapi:generate` writes
   `services/*/openapi.json`; a test fails if the committed file differs.
3. Supertest suite per service with in-memory fakes: hit each route, `schema.strict().parse(body)`; error bodies parsed with the
   error schema; a coverage test fails if a route in the table has no schema.
4. Negative request table per route (missing/extra/wrong-type fields, bad params, upload MIME/size) → 400 + `fieldErrors`.
5. Schemathesis job against the compose stack (auth cookie from a seeded test user); JUnit artifact; merge gate.
6. SSE: parse every event written by `writeSseEvent` with the SSE schema; check the mfe-chat type matches.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-183](https://ipca-grupo11.atlassian.net/browse/AICHAT-183) | AICHAT-12-US1 | As a team, I want every route mapped to one request/response schema | Route table; drift documented; source-of-truth decision with owners | 2 |
| [AICHAT-184](https://ipca-grupo11.atlassian.net/browse/AICHAT-184) | AICHAT-12-US2 | As a developer, I want an OpenAPI spec generated from Zod | OpenAPI 3.1 for both services; cookie auth + error envelope; staleness test | 5 |
| [AICHAT-185](https://ipca-grupo11.atlassian.net/browse/AICHAT-185) | AICHAT-12-US3 | As a frontend developer, I want every response checked against its schema | Strict parse per route; error bodies + correlation id; missing schema fails | 5 |
| [AICHAT-186](https://ipca-grupo11.atlassian.net/browse/AICHAT-186) | AICHAT-12-US4 | As a backend developer, I want invalid requests rejected consistently | Table-driven negatives; 400 + `fieldErrors`, never 500; upload MIME/size | 3 |
| [AICHAT-187](https://ipca-grupo11.atlassian.net/browse/AICHAT-187) | AICHAT-12-US5 | As a tester, I want Schemathesis to fuzz the API from the spec | Runs on compose stack with auth; three checks; findings triaged; merge gate; JUnit artifact | 3 |
| [AICHAT-188](https://ipca-grupo11.atlassian.net/browse/AICHAT-188) | AICHAT-12-US6 | As a developer, I want every SSE event validated against one schema | All event types parsed; mfe-chat type checked; coordinated with AICHAT-20 | 2 |
| | | **Total** | | **20** |

## 7. Risks and open decisions

- Zod 4 support in OpenAPI generators: confirm the library version before US2.
- Moving schemas into shared-types touches both services; needs the owners' agreement (US1).
- Schemathesis can create lots of data and hit rate limits (auth-service has a global limiter); use a dedicated user and a
  higher limit in the CI stack.

## 8. Notes for the report

Each service validates its inputs, but responses were never checked, the shared schema package is barely used, and there was
no API description. Generating the spec from the same Zod schemas the code uses keeps it from drifting, and lets a fuzzer test
inputs nobody wrote by hand.
