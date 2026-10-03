---
title: "AICHAT-20 · [Foundations] Snapshot testing"
---

# AICHAT-20 · [Foundations] Snapshot testing

| Field | Value |
|---|---|
| Jira | [AICHAT-20](https://ipca-grupo11.atlassian.net/browse/AICHAT-20) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-12 (API schema validation), AICHAT-11 (Pact), unassigned "SSE event contract testing" |
| Layer | Shared types / API payloads |

## 1. Goal

Use snapshots **only for small, stable serialized outputs (DTOs)**: API responses, SSE events, error bodies. Never
snapshot large component trees, which become brittle and get rubber-stamped with `-u`.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** DTOs and wire outputs in §4.2 confirmed as the only snapshot targets (no component trees)
- [ ] **Tooling agreed:** Vitest inline/file snapshots, UUID/date serializer and `vitest/no-large-snapshots` lint rule confirmed
- [ ] Target environment available
- [ ] DTOs to snapshot listed → **§4.2**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Only serialized DTOs snapshotted
- [ ] No component-tree snapshots remain

## 3. Technologies

| Tool | Role |
|---|---|
| Vitest `toMatchSnapshot` / `toMatchInlineSnapshot` / `toMatchFileSnapshot` | Snapshot assertions (Vitest `^5.0.1`, already installed) |
| Zod (`^4.x`) | DTOs are Zod schemas in `packages/shared-types`; snapshots taken of `schema.parse(fixture)` output |
| `expect.addSnapshotSerializer` | Custom serializer to replace volatile values (UUIDs, ISO dates, correlation ids) with stable placeholders |
| ESLint rule (`vitest/no-large-snapshots`, from `@vitest/eslint-plugin`) | Enforces "small snapshots only" and can forbid snapshots in `*.tsx` tests |
| CI `--ci` behaviour | In CI Vitest does not write new snapshots, so a missing snapshot fails instead of being silently created |

## 4. Discovery: current state

### 4.1 Existing snapshots
**None.** No `toMatchSnapshot`, `toMatchInlineSnapshot` or `__snapshots__` folders outside `node_modules`.
So the DoD "no component-tree snapshots remain" is met today; the work is to **add DTO snapshots and a guard so
component snapshots never appear**.

### 4.2 Candidate DTOs (`packages/shared-types/src`)

| File | Schemas worth snapshotting (serialized output) |
|---|---|
| `auth/dto.ts` | `userProfileSchema`, `authResponseSchema` |
| `auth/jwt.ts` | `accessTokenClaimsSchema` (claim names are a cross-service contract) |
| `chat/chat.ts` | `chatSchema`, `chatMemberSchema` |
| `chat/message.ts` | `messageSchema` (incl. `webFetchSchema`, status enum) |
| `chat/attachment.ts` | `attachmentSchema` |
| `chat/sse.ts` | every event in `sseEventSchema` (`token`, `reasoning`, `web_fetch`, `done`, `error`, `queued`) |
| `http/error-response.ts` | `toErrorResponse()` output |
| `api-keys/test-connection.ts` | `testConnectionResponseSchema` |

Backend serializers worth snapshotting (produce the wire JSON):
- `services/conversation-service/src/features/streaming/sse.ts`: the exact `event:`/`data:` frame text.
- `services/conversation-service/src/shared/error-handler.ts` and `services/auth-service/src/shared/error-middleware.ts`: error body shape.

### 4.3 Report-worthy findings
- **mfe-chat does not use `packages/shared-types`.** It declares its own `SSEEvent` in `apps/mfe-chat/src/shared/types.ts`, which has **`message` and `started` events that `packages/shared-types/src/chat/sse.ts` lacks**. The two definitions have drifted. A snapshot of the backend's real frames compared with both type sets would show this.
- There are two `LLM_API_KEY_HEADER` constants (`api-keys/schema.ts` and `chat/provider.ts`).

## 5. Implementation plan (steps)

1. Write the rules (in this folder): snapshot **only** `*.test.ts` files of DTOs/serializers; inline snapshots for objects up to ~20 lines, file snapshots above that.
2. Add a fixtures module `packages/shared-types/src/__fixtures__/` with one canonical example per DTO (also reusable by AICHAT-19 visual mocks and AICHAT-11 Pact).
3. Add a serializer that replaces UUIDs/ISO dates with `<uuid>`/`<date>`.
4. Snapshot `schema.parse(fixture)` for every DTO in §4.2.
5. Snapshot the backend wire output: SSE frames for each event type and error bodies for 400/401/403/404/409/422/500.
6. Add the ESLint guard: `vitest/no-large-snapshots` (max ~50 lines) and a `no-restricted-syntax` rule banning `toMatchSnapshot` in `*.test.tsx` (component files).
7. CI: tests already run in `nx affected -t test`; check that a missing snapshot fails in CI mode.
8. Document how to review and update snapshots (`vitest -u` locally, never in CI).

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-42](https://ipca-grupo11.atlassian.net/browse/AICHAT-42) | AICHAT-20-US1 | As a developer, I want canonical DTO fixtures so that every test layer uses the same example payloads | One fixture per schema in §4.2, each passing `schema.parse` | 2 |
| [AICHAT-59](https://ipca-grupo11.atlassian.net/browse/AICHAT-59) | AICHAT-20-US2 | As a developer, I want snapshot tests of the shared DTOs so that any change to the wire shape is visible in review | Inline/file snapshots for all §4.2 schemas; UUIDs/dates normalised | 3 |
| [AICHAT-77](https://ipca-grupo11.atlassian.net/browse/AICHAT-77) | AICHAT-20-US3 | As a frontend developer, I want snapshots of the SSE frames and error bodies the services send so that mfe-chat's expectations can be compared | Snapshots of `streaming/sse.ts` frames and error middleware output in both services | 3 |
| [AICHAT-95](https://ipca-grupo11.atlassian.net/browse/AICHAT-95) | AICHAT-20-US4 | As a team, I want a lint rule against component-tree and large snapshots so that brittle snapshots never enter the codebase | ESLint rule active in `packages/eslint-config`; a test `.tsx` with `toMatchSnapshot` fails lint | 2 |
| [AICHAT-113](https://ipca-grupo11.atlassian.net/browse/AICHAT-113) | AICHAT-20-US5 | As a maintainer, I want the SSE type drift between mfe-chat and shared-types reported so that it gets fixed | Issue raised to the chat owner with the two definitions side by side | 1 |

## 7. Risks and open decisions

- Snapshots lose value if updated without review. The PR template should ask "why did this snapshot change?".
- The overlap with Pact (AICHAT-11) and API schema validation (AICHAT-12): snapshots check *shape stability*, Pact checks *consumer expectations*, schema validation checks *validity*. They complement each other.

## 8. Notes for the report

The repo has no snapshots, so it is not at risk of brittle component snapshots. The value of this epic is to **freeze the
wire contracts** (DTOs, SSE frames, error bodies). Discovery found the SSE event types **already drifted** between
the frontend (`message`, `started` events) and the shared package, which is exactly the kind of change DTO snapshots make visible.
