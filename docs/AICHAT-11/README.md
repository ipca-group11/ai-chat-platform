---
title: "AICHAT-11 · [Foundations] Consumer-driven contract testing"
---

# AICHAT-11 · [Foundations] Consumer-driven contract testing

| Field | Value |
|---|---|
| Jira | [AICHAT-11](https://ipca-grupo11.atlassian.net/browse/AICHAT-11) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Related | AICHAT-12 (schema validation, same contracts from the provider side), AICHAT-15 (stop endpoint mismatch) |
| Layer | MFE ↔ microservice REST boundary |

## 1. Goal

**Every MFE → service REST call has a Pact**, written from the real client code, and **each provider verifies those pacts in
CI**, so a backend change that breaks a frontend (or a frontend calling an endpoint that does not exist) fails before merge.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Pact JS V3 consumer tests in Vitest; provider verification in-process; broker vs CI artifacts
- [ ] Target environment available (CI only; no stack needed)
- [x] **`packages/pact-config` set up** → exists, see §4.1
- [ ] **Consumer/provider pairs listed** → draft in §4.2, agreed in US1

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Every MFE → service REST call has a pact
- [ ] Provider verification runs in CI

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| `@pact-foundation/pact` | `^17.1.4` (only in `packages/pact-config`) | `PactV3` consumer mock server; `Verifier` for providers |
| `@platform/pact-config` | in repo | `pactConsumerOptions`, `PACT_DIR`, broker env names, matchers (`like`, `eachLike`, `term`, `errorResponseMatcher`, `correlationHeaderMatcher`) |
| Vitest | `5.0.1` | Runner for consumer and provider tests |
| Pact Broker / PactFlow (optional) | — | Share pacts across pipelines; `can-i-deploy` |
| Nx | `23.2.1` | `pact:consumer` / `pact:verify` targets |

## 4. Discovery: current state

### 4.1 Scaffolding

`packages/pact-config` (README, `pact.config.ts`, `matchers.ts`, both unit-tested) defines the conventions and states that the
contract tests themselves live in each `apps/mfe-*` / `services/*`. **No app or service depends on `@pact-foundation/pact`
and no pact file exists.**

### 4.2 Consumer → provider pairs (draft)

| Consumer | Client files | Provider | Endpoints |
|---|---|---|---|
| mfe-auth | `features/login/api/{login,session}.ts`, `features/register/api/register.ts`, `shared/api-client.ts` | auth-service | `POST /register`, `/login`, `/refresh`, `/logout`; `GET /me` |
| shell | `features/auth-guard/api/useSession.ts`, `shared/http/apiClient.ts` | auth-service | `GET /me`, `POST /refresh` |
| mfe-settings | `features/api-keys/api/auth.ts` | auth-service | session calls (confirm in US1) |
| mfe-chat | `features/chat-list/api/chats.ts`, `features/chat-members/api/members.ts`, `features/chat-view/api/messages.ts`, `features/attachments/api/useUploadAttachment.ts` | conversation-service | chats CRUD, members, messages (list/send/edit/cancel/retry/stop), attachment upload |

Providers' routes: `services/auth-service/src/features/{session,register}/api.ts`;
`services/conversation-service/src/features/{chats,messages,attachments,streaming}/routes.ts`.
SSE (`GET /chats/:chatId/stream`) is **out of scope** for Pact (HTTP request/response only); covered by AICHAT-12-US6.

### 4.3 Known mismatch (will fail verification)

`useStopMessage` in `apps/mfe-chat/src/features/chat-view/api/messages.ts` posts to
`/chats/:chatId/messages/:messageId/stop`, but conversation-service only exposes `POST /chats/:chatId/stop`
(`features/messages/routes.ts`). Contract testing will surface it; the fix is tracked in AICHAT-15-US1.

### 4.4 Provider test support already present

conversation-service has in-memory fakes in `src/test-utils/` (chats, messages, attachments repositories, storage, mock stream,
principal) usable for provider states. auth-service needs a fake repository or a test database for states.

## 5. Implementation plan (steps)

1. US1: confirm the pairs table; decide broker vs CI artifacts (no broker → pacts uploaded/downloaded within one workflow run).
2. Add `@pact-foundation/pact` as a dev dependency where needed; one `*.pact.spec.ts` per consumer API file, calling the real
   client functions against the Pact mock server; shared matchers for error envelope and correlation header.
3. Provider verification specs start the Express app on a random port with fakes, register state handlers, verify all pacts for
   that provider.
4. Nx targets `pact:consumer` (consumers) and `pact:verify` (providers); `ci.yml` runs consumers first, then providers.
5. Document in `packages/pact-config/README.md`.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-177](https://ipca-grupo11.atlassian.net/browse/AICHAT-177) | AICHAT-11-US1 | As a team, I want every MFE → service call listed and a pact-sharing decision | Pairs + endpoints listed; broker vs CI artifacts decided; baseline recorded | 1 |
| [AICHAT-178](https://ipca-grupo11.atlassian.net/browse/AICHAT-178) | AICHAT-11-US2 | As a frontend developer, I want pacts for every auth-service call | register/login/refresh/logout/me, success and error; shared matchers; real client code; files in `PACT_DIR` | 3 |
| [AICHAT-179](https://ipca-grupo11.atlassian.net/browse/AICHAT-179) | AICHAT-11-US3 | As a frontend developer, I want pacts for every conversation-service call | Chats, members, messages, upload; stop written as the client calls it today (expected failure → defect); multipart fixture | 5 |
| [AICHAT-180](https://ipca-grupo11.atlassian.net/browse/AICHAT-180) | AICHAT-11-US4 | As a backend developer, I want auth-service verified against its consumers | In-process verifier; provider states; fails on mismatch | 3 |
| [AICHAT-181](https://ipca-grupo11.atlassian.net/browse/AICHAT-181) | AICHAT-11-US5 | As a backend developer, I want conversation-service verified against mfe-chat | States with `src/test-utils` fakes + test JWT; owner/member/non-member; stop mismatch fixed and passing | 5 |
| [AICHAT-182](https://ipca-grupo11.atlassian.net/browse/AICHAT-182) | AICHAT-11-US6 | As a team, I want contract tests in CI with a merge gate | Nx targets in `ci.yml`; provider uses the run's pacts (or broker); README updated | 3 |
| | | **Total** | | **20** |

## 7. Risks and open decisions

- **Broker:** none exists; self-hosting is extra infrastructure. CI artifacts are enough for a monorepo.
- Consumer tests must call the real client code; hand-written fetches in tests would hide drift.
- `nx affected` may skip a provider when only a consumer changed; the verify job must depend on consumer changes too.

## 8. Notes for the report

The team had prepared shared Pact configuration but no contracts. While mapping the calls for this epic we found a real
mismatch: the chat UI's Stop request targets a route the service does not expose, which no existing test caught. This is
exactly the class of defect consumer-driven contracts prevent, and it gives the epic a concrete before/after result.
