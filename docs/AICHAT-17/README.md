---
title: "AICHAT-17 · [Foundations] Unit testing"
---

# AICHAT-17 · [Foundations] Unit testing

| Field | Value |
|---|---|
| Jira | [AICHAT-17](https://ipca-grupo11.atlassian.net/browse/AICHAT-17) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Depends on | AICHAT-34 (coverage thresholds) |
| Related | AICHAT-18 (deep state testing of Composer, ChatView, ProviderList), AICHAT-23 (route-level tests of controllers) |
| Layer | **All source files of the monorepo**: `apps/*`, `packages/*`, `services/*`, `e2e/src` helpers |
| Policy | [UNIT-TEST-POLICY.md](UNIT-TEST-POLICY.md) · exempt list [`unit-test-exempt.json`](../../packages/workspace-config/unit-test-exempt.json) |

## 1. Goal

**Every source file** in the monorepo has a fast, isolated Vitest unit test, or sits on an explicit, justified exempt list
(bootstrap entry points, barrel `index` files, type-only modules). This covers frontend and backend: hooks, utils, models,
API clients, components, services, controllers, middleware, config packages and test helpers. Logic bugs are then caught before
they reach a component, integration or E2E test, and a guard keeps new files from shipping without a test.

The Jira text names "hooks, utils and model capability tables". These stay in scope (§4.3), now as part of the whole-repo scope.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** every source file in `apps/*/src`, `packages/*`, `services/*/src` and `e2e/src` (246 files, §4.1) is in scope; the exempt categories in §4.2 are agreed
- [ ] **Tooling agreed:** Vitest + Testing Library (`render`, `renderHook`) + supertest confirmed; MSW adopted or rejected (US10)
- [ ] Target environment available (local, CI or VM)
- [ ] Files to cover listed → **done in §4 of this doc** (Jira: "hooks, utils and capability tables to cover listed")

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions in README or `docs/`
- [ ] Every non-exempt source file has a unit test (Jira: "hooks, utils and model capability tables covered")
- [ ] A guard test fails when a new source file has no test and isn't on the exempt list
- [ ] Meets the AICHAT-34 coverage thresholds

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| Vitest | `^5.0.1` / `5.0.1` | Runner in every project, mocks (`vi.fn`, `vi.mock`, `vi.stubGlobal`), fake timers, coverage (`@vitest/coverage-v8`) |
| `@testing-library/react` | `^16.3.3` | `render` for components, `renderHook` for hooks |
| `@testing-library/user-event` | `^14.6.7` | Interaction in component unit tests |
| `@testing-library/jest-dom` | `^7.0.1` | DOM matchers |
| jsdom | `^30.1.1` | Browser environment for `apps/*` and `packages/ui` |
| supertest | `^7.2.1` | Controller/middleware tests in `services/*` |
| `@tanstack/react-query` | in apps | Hooks under test need a `QueryClientProvider` |
| ESLint `RuleTester` (from `eslint`) | `^10` | Unit tests for the custom rule and configs in `packages/eslint-config` |
| Nx | `23.2.1` | `nx affected -t test` in `.github/workflows/ci.yml` |

Optional (to be agreed): **MSW** (`msw`) to replace ~23 hand-written `vi.stubGlobal("fetch", ...)` stubs with one handler set per API.

## 4. Discovery: current state

Baseline: `nx run-many -t test` is green on all 15 projects (2026-10-03).

### 4.1 Whole-repo inventory

Method: every tracked `.ts/.tsx/.js` source file under `apps/*/src`, `packages/*`, `services/*/src`, `e2e/src`, excluding
tests, `.d.ts`, stories, generated code (`routeTree.gen.ts`, Prisma client, `@mf-types`), test helpers and tool configs.
- **Direct:** a co-located `*.spec|test.*` file exists.
- **Indirect:** no own test, but another test imports it, so it is exercised but not unit-tested on its own.
- **None:** no test imports it at all (it may still be reached transitively; check the coverage report).

| Project | Source files | Direct | Indirect | **None** | Barrels (`index`) |
|---|---|---|---|---|---|
| `apps/mfe-auth` | 20 | 6 | 4 | **8** | 2 |
| `apps/mfe-chat` | 49 | 24 | 5 | **14** | 6 |
| `apps/mfe-settings` | 14 | 11 | 1 | **1** | 1 |
| `apps/shell` | 29 | 3 | 7 | **13** | 6 |
| `e2e/src` (helpers) | 7 | 2 | 4 | **1** | 0 |
| `packages/eslint-config` | 6 | 1 | 0 | **4** | 1 |
| `packages/observability` | 11 | 8 | 0 | 0 | 3 |
| `packages/pact-config` | 3 | 2 | 0 | 0 | 1 |
| `packages/shared-types` | 18 | 12 | 1 | 0 | 5 |
| `packages/test-config` | 3 | 2 | 0 | 0 | 1 |
| `packages/ui` | 19 | 17 | 0 | **1** | 1 |
| `packages/workspace-config` | 1 | 1 | 0 | 0 | 0 |
| `services/auth-service` | 20 | 13 | 3 | **1** | 3 |
| `services/conversation-service` | 46 | 28 | 5 | **6** | 7 |
| **Total** | **246** | **130** | **30** | **49** | **37** |

So **53% of source files have their own unit test**, 12% are reached only through other tests, and **20% have no test**.

### 4.2 Files with no test, by category

**A. Logic with no test → must get a unit test**

| Project | Files |
|---|---|
| `apps/mfe-auth` | `features/login/hooks/useLogin.ts`, `features/login/hooks/useLogout.ts`, `features/register/hooks/useRegister.ts`, `features/login/model.ts`, `features/register/model.ts`, `shared/schemas.ts` |
| `apps/mfe-chat` | `app/use-media-query.ts`, `features/attachments/api/useUploadAttachment.ts`, `features/message-queue/hooks/useMessageQueue.ts`, `shared/api-client.ts`, `shared/auth.ts`, `shared/sse.ts` |
| `apps/shell` | `app/queryClient.ts`, `features/auth-guard/api/useSession.ts`, `features/auth-guard/model/session.ts`, `features/remote-loader/model/loadRemote.ts`, `shared/http/constants.ts` |
| `services/conversation-service` | `shared/async-handler.ts`, `features/{attachments,chats,messages}/controller.ts` (reached by the route specs; add focused unit tests for the request → service → response mapping) |
| `packages/eslint-config` | `src/base.js`, `src/node.js`, `src/react.js`, `src/local-plugin.js` (test by linting small fixture files and asserting the expected rules fire) |
| `e2e/src` | `fixtures/wait-for-stack-cli.ts` (argument parsing and exit codes) |

**B. Components with no own test → render-level unit test** (render, props, main interaction; the three key components get deep state testing in AICHAT-18)

| Project | Files |
|---|---|
| `apps/mfe-auth` | `shared/components/AuthCard.tsx` |
| `apps/mfe-chat` | `app/ChatDetailPage.tsx`, `app/ChatListPage.tsx`, `app/ChatWorkspace.tsx`, `features/chat-view/components/MessageBubble.tsx`, `ReasoningSection.tsx`, `WebFetchList.tsx` (incl. the `isWebUrl` guard on model-supplied URLs), `features/message-queue/components/QueuedMessageItem.tsx` |
| `apps/shell` | `features/remote-loader/components/RemoteFallback.tsx`, `shared/layout/AppShellLayout.tsx`, `shared/layout/NavBar.tsx` (incl. theme toggle) |
| `packages/ui` | `components/alert/alert.tsx` (the only design-system component without a test; it has a story) |

**C. Type-only / constant modules → test only if they hold logic**

`services/auth-service/src/shared/contracts/http.ts`, `services/conversation-service/src/shared/contracts/auth.ts`. Check
whether they export runtime values (Zod schemas, constants). If so, test them; if they are types only, add them to the exempt list.

**D. Bootstrap / wiring → exempt from unit tests, covered by E2E** (to agree)

`apps/*/src/main.tsx` (×3), `apps/shell/src/App.tsx`, `apps/mfe-chat/src/app/remote-entry.tsx`, `apps/shell/src/routes/__root.tsx`,
`routes/chats.$chatId.tsx`, `routes/register.tsx`, `services/conversation-service/src/server.ts`.
Note: some shell route files *do* have tests (e.g. `router.test.ts`), so the route files without one should be checked case by case before being exempted.

**E. Barrel `index` files (37) → exempt** (re-exports only; already excluded from coverage in several configs).

**Indirect files (30)** are exercised through other tests. Each gets a focused test only where it has its own branching
logic (e.g. `mfe-auth/shared/correlation.ts`, `shared/navigation.ts`, `mfe-chat/features/chat-members/api/members.ts`, `mfe-chat/app/auth-context.tsx`).

### 4.3 Model capability tables (named in the Jira epic)

| File | Content | Test quality |
|---|---|---|
| `apps/mfe-chat/src/shared/model-capabilities.ts` | Regex per provider for reasoning (`/^(o\d\|gpt-[5-9])/`, `/claude-(fable\|mythos\|opus-[45]\|sonnet-[45]\|haiku-4\|3-7-sonnet)/`) and web fetch (OpenAI `null`) | Hand-written `expect` lines; 6 models for reasoning, 4 for web fetch. `gpt-4o-mini`, `gpt-4.1`, `claude-sonnet-5-5`, `claude-3-5-haiku-latest` not asserted |
| `apps/mfe-chat/src/features/attachments/model/model-capabilities.ts` | Vision allow-list (9 models) | Only 2 of 9 vision models asserted; text/pdf for one model only |
| `apps/mfe-chat/src/shared/types.ts` `PROVIDER_MODELS` | Source of truth for selectable models (5 OpenAI + 5 Anthropic) | Not cross-checked against the two tables |
| `services/conversation-service/src/features/llm-adapters/{anthropic,openai}.provider.ts` | Backend tables `THINKING_STYLES`, `WEB_FETCH_TOOLS`, `VISION_MODEL_HINTS` | Tested by example in the adapter specs |

**Finding (report-worthy):** the frontend and backend tables are duplicated and nothing checks that they agree for each model in
`PROVIDER_MODELS`, so the UI can offer a toggle that the backend silently ignores.

### 4.4 Coverage enforcement (see AICHAT-34)

- `apps/shell` and `packages/ui` run `vitest run` **without `--coverage`**, so their thresholds are not enforced.
- `apps/mfe-auth` and `e2e` have **no thresholds**.
- `apps/mfe-chat` excludes the whole `src/app/**` folder from coverage, which hides the category-B page components above.

## 5. Implementation plan (steps)

1. **Agree on the policy:** "every source file has a co-located unit test unless it is on `unit-test-exempt.json`" with categories D, E and type-only C. Record the exempt list with one reason per entry.
2. **Shared helpers:** `renderWithClient` / `renderHookWithClient` (QueryClient with retries off) per app or in a shared `packages/test-utils`; extract the fake `EventSource` from `ChatView.test.tsx`; for services, keep `test-utils/` fakes (AICHAT-23).
3. (Optional, decide first) Add MSW with one handler set per API.
4. **Category A, per project, one PR each:** mfe-auth (6 files), mfe-chat (6), shell (5), conversation-service (4), eslint-config (4), e2e (1).
5. **Category B:** render-level tests for the 12 components (render with typical props, empty/edge props, main interaction, accessible names).
6. **Category C:** check each module; test it or exempt it.
7. **Capability tables:** rewrite as **table-driven** `it.each` over every model in `PROVIDER_MODELS` × capability; add the **frontend/backend parity test**.
8. **Indirect files with own branching logic:** add focused tests.
9. **Guard test** (in `packages/workspace-config`, which already tests repo structure): list source files with the same rules as §4.1 and fail when a file has neither a co-located test nor an exempt-list entry.
10. Turn on enforcement (AICHAT-34) and confirm CI fails on a deliberate drop.
11. Document how to run (`pnpm exec nx run <project>:test`, watch mode, coverage report path) and the test-file convention in `docs/AICHAT-17/RUNNING.md`.

## 6. User stories

Stories are grouped **by MFE and microservice**, so each project is delivered and reviewed on its own.

| Jira | ID | Project | Story | Acceptance criteria | Est. |
|---|---|---|---|---|---|
| [AICHAT-36](https://ipca-grupo11.atlassian.net/browse/AICHAT-36) | AICHAT-17-US1 | `All` | As a team, I want an "every source file has a unit test" policy with an agreed exempt list so that the scope per MFE and microservice is unambiguous | `unit-test-exempt.json` lists bootstrap files, barrel `index` files and type-only modules, one reason per entry; Route files without a test checked case by case before being exempted; Policy approved by the team and linked from the epic | 1 |
| [AICHAT-51](https://ipca-grupo11.atlassian.net/browse/AICHAT-51) | AICHAT-17-US2 | `All MFEs` | As a developer, I want shared render/hook test helpers so that MFE tests don't repeat QueryClient and EventSource boilerplate | `renderWithClient` and `renderHookWithClient` (QueryClient with retries off) available to every MFE; Fake `EventSource` extracted from `ChatView.test.tsx` into a reusable helper; At least 3 existing tests migrated to the helpers | 2 |
| [AICHAT-105](https://ipca-grupo11.atlassian.net/browse/AICHAT-105) | AICHAT-17-US5 | `apps/shell` | As a developer, I want every shell source file unit-tested so that session handling, remote loading and layout regressions are caught early | Logic: `app/queryClient.ts`, `features/auth-guard/api/useSession.ts`, `features/auth-guard/model/session.ts`, `features/remote-loader/model/loadRemote.ts`, `shared/http/constants.ts` tested incl. error paths; Components: `RemoteFallback.tsx`, `AppShellLayout.tsx`, `NavBar.tsx` (incl. theme toggle) have render-level tests; Route files without a test are tested or added to the exempt list; shell runs `vitest run --coverage` so its thresholds are enforced | 5 |
| [AICHAT-69](https://ipca-grupo11.atlassian.net/browse/AICHAT-69) | AICHAT-17-US3 | `apps/mfe-auth` | As a developer, I want every mfe-auth source file unit-tested so that login, logout and registration logic is safe to change | Hooks `useLogin`, `useLogout`, `useRegister` tested for success, validation error and server error; `features/login/model.ts`, `features/register/model.ts`, `shared/schemas.ts` tested; `shared/components/AuthCard.tsx` has a render-level test; Indirect files with own logic (`shared/correlation.ts`, `shared/navigation.ts`) get focused tests; mfe-auth has coverage thresholds configured | 5 |
| [AICHAT-87](https://ipca-grupo11.atlassian.net/browse/AICHAT-87) | AICHAT-17-US4 | `apps/mfe-chat` | As a developer, I want the untested mfe-chat logic unit-tested so that chat streaming, uploads and the message queue are reliable | `app/use-media-query.ts`, `features/attachments/api/useUploadAttachment.ts`, `features/message-queue/hooks/useMessageQueue.ts` tested; `shared/api-client.ts`, `shared/auth.ts`, `shared/sse.ts` tested incl. error and reconnect paths; Indirect files with own logic (`features/chat-members/api/members.ts`, `app/auth-context.tsx`) get focused tests | 5 |
| [AICHAT-126](https://ipca-grupo11.atlassian.net/browse/AICHAT-126) | AICHAT-17-US7 | `apps/mfe-chat` | As a developer, I want a render-level unit test for every mfe-chat component and page that has none so that UI regressions are caught before E2E | `ChatDetailPage`, `ChatListPage`, `ChatWorkspace`, `MessageBubble`, `ReasoningSection`, `QueuedMessageItem` tested (render, props, main interaction, accessible names); `WebFetchList` tested incl. the `isWebUrl` guard on model-supplied URLs; The `src/app/**` coverage exclusion removed from mfe-chat | 5 |
| [AICHAT-129](https://ipca-grupo11.atlassian.net/browse/AICHAT-129) | AICHAT-17-US8 | `apps/mfe-chat` | As a developer, I want table-driven tests for the mfe-chat model capability tables so that every selectable model is checked | `it.each` over every `PROVIDER_MODELS` entry for reasoning, web fetch, vision, text and pdf; A model missing from a capability table fails the test | 3 |
| [AICHAT-141](https://ipca-grupo11.atlassian.net/browse/AICHAT-141) | AICHAT-17-US12 | `apps/mfe-settings` | As a developer, I want the last untested mfe-settings files covered so that the MFE reaches full per-file unit coverage | The file with no test and the indirectly tested file get focused unit tests (or an exempt entry with a reason); mfe-settings coverage thresholds still met | 1 |
| [AICHAT-142](https://ipca-grupo11.atlassian.net/browse/AICHAT-142) | AICHAT-17-US13 | `services/auth-service` | As a developer, I want every auth-service source file unit-tested so that authentication logic is covered file by file | `shared/contracts/http.ts` tested if it exports runtime values, otherwise exempted as type-only; The 3 indirectly tested files get focused tests where they have their own branching logic; auth-service coverage thresholds still met | 2 |
| [AICHAT-123](https://ipca-grupo11.atlassian.net/browse/AICHAT-123) | AICHAT-17-US6 | `services/conversation-service` | As a developer, I want every conversation-service source file unit-tested so that request handling and provider logic are covered file by file | `shared/async-handler.ts` tested (resolved, rejected, thrown); `features/{attachments,chats,messages}/controller.ts` have focused tests for the request → service → response mapping; `shared/contracts/auth.ts` tested or exempted as type-only; Backend capability tables (`THINKING_STYLES`, `WEB_FETCH_TOOLS`, `VISION_MODEL_HINTS`) covered by table-driven tests | 5 |
| [AICHAT-133](https://ipca-grupo11.atlassian.net/browse/AICHAT-133) | AICHAT-17-US9 | `mfe-chat ↔ conversation-service` | As a product owner, I want the mfe-chat and conversation-service capability tables to agree so that the UI never offers a feature the backend ignores | Parity test checks every model in `PROVIDER_MODELS` for reasoning, web fetch and vision; A mismatch between frontend and backend tables fails CI; Approach agreed (shared module or JSON export) if it requires moving the table | 5 |
| [AICHAT-143](https://ipca-grupo11.atlassian.net/browse/AICHAT-143) | AICHAT-17-US14 | `packages/* and e2e` | As a developer, I want the shared packages and test tooling unit-tested so that every project the MFEs and services depend on is covered | `packages/ui` `components/alert/alert.tsx` has a test; `packages/eslint-config` `base.js`, `node.js`, `react.js`, `local-plugin.js` tested by linting fixture files (`RuleTester`); `e2e/src/fixtures/wait-for-stack-cli.ts` tested (argument parsing, exit codes) | 3 |
| [AICHAT-135](https://ipca-grupo11.atlassian.net/browse/AICHAT-135) | AICHAT-17-US10 | `All MFEs` | (Spike, optional) As a developer, I want to evaluate MSW so that HTTP mocking is consistent across the MFEs | Decision recorded in the epic README; If adopted, handlers for auth, chats, messages and settings replace the hand-written `fetch` stubs | 2 |
| [AICHAT-138](https://ipca-grupo11.atlassian.net/browse/AICHAT-138) | AICHAT-17-US11 | `All` | As a team, I want a guard that fails when a new source file in any MFE, microservice or package has no unit test | Guard test in `packages/workspace-config` lists source files with the same rules as the inventory; Adding an untested file without an exempt entry fails CI | 3 |
| | | | **Total** | | **47** |

## 7. Risks and open decisions

- **Whole-repo scope is larger** than the Jira wording (hooks/utils/tables). Confirm this with the team and update the Jira epic description if agreed.
- "Every file has a test" can lead to shallow tests written just to pass the guard. Pair the guard with the coverage thresholds (AICHAT-34) and, later, mutation testing (AICHAT-16).
- **Overlap with AICHAT-18 and AICHAT-23:** components get a render-level unit test here, with deep state matrices in AICHAT-18; controllers get focused unit tests here, with full HTTP error-path tests in AICHAT-23.
- **MSW or not?** Adds a dependency but removes ~23 hand-rolled fetch stubs. **Decided 2026-10-03: settle it in the time-boxed spike AICHAT-135.**
- The capability parity test needs the frontend test to read the backend tables (shared module or JSON export). Moving the table to `packages/shared-types` would be an app change and must be agreed. **Decided 2026-10-03: move the tables to `packages/shared-types`** (see WORKLOG §1).

## 8. Notes for the report

Unit tests are already the base of the pyramid (green on all 15 Nx projects), but a whole-repo inventory of **246 source files**
shows that only **130 (53%) have their own unit test**. 30 are only exercised through other tests, and **49 (20%) have no test
at all**: hooks and API clients in mfe-auth, mfe-chat and the shell; 12 presentational components; backend controllers; and the
ESLint config package. The plan makes the scope **every source file**, with an explicit, justified exempt list (bootstrap, barrels,
type-only files). It adds a guard test so new files can't ship without a test, and keeps the capability-table work (exhaustive table
tests plus a frontend/backend parity check) named in the Jira epic.
