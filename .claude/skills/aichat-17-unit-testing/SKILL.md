---
name: aichat-17-unit-testing
description: Run epic AICHAT-17 (Unit testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-17", "work on AICHAT-17", "continue AICHAT-17".
---

# AICHAT-17 · [Foundations] Unit testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-17. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-17 · [Foundations] Unit testing |
| Branch | `test/AICHAT-17-unit-testing` |
| Work log | `docs/AICHAT-17/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-17/evidence/` |
| Layer | **All source files of the monorepo**: `apps/*`, `packages/*`, `services/*`, `e2e/src` helpers |
| Depends on | AICHAT-34 (coverage thresholds) |
| Related | AICHAT-18 (deep state testing of Composer, ChatView, ProviderList), AICHAT-23 (route-level tests of controllers) |

## Goal

**Every source file** in the monorepo has a fast, isolated Vitest unit test, or sits on an explicit, justified exempt list
(bootstrap entry points, barrel `index` files, type-only modules). This covers frontend and backend: hooks, utils, models,
API clients, components, services, controllers, middleware, config packages and test helpers. Logic bugs are then caught before
they reach a component, integration or E2E test, and a guard keeps new files from shipping without a test.

The Jira text names "hooks, utils and model capability tables". These stay in scope (§4.3), now as part of the whole-repo scope.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-17/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-17/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-17/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-17/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: every source file in `apps/*/src`, `packages/*`, `services/*/src` and `e2e/src` (246 files, §4.1) is in scope; the exempt categories in §4.2 are agreed
2. Tooling agreed: Vitest + Testing Library (`render`, `renderHook`) + supertest confirmed; MSW adopted or rejected (US10)
3. Target environment available (local, CI or VM)
4. Files to cover listed → done in §4 of this doc (Jira: "hooks, utils and capability tables to cover listed")

Open decisions from the analysis (ask the ones not already settled):
  - **Whole-repo scope is larger** than the Jira wording (hooks/utils/tables). Confirm this with the team and update the Jira epic description if agreed.
  - "Every file has a test" can lead to shallow tests written just to pass the guard. Pair the guard with the coverage thresholds (AICHAT-34) and, later, mutation testing (AICHAT-16).
  - **Overlap with AICHAT-18 and AICHAT-23:** components get a render-level unit test here, with deep state matrices in AICHAT-18; controllers get focused unit tests here, with full HTTP error-path tests in AICHAT-23.
  - **MSW or not?** Adds a dependency but removes ~23 hand-rolled fetch stubs.
  - The capability parity test needs the frontend test to read the backend tables (shared module or JSON export). Moving the table to `packages/shared-types` would be an app change and must be agreed.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-36 | Agree unit-test policy and exempt list (`All`) | 1 | `unit-test-exempt.json` lists bootstrap files, barrel `index` files and type-only modules, one reason per entry; Route files without a test checked case by case before being exempted; Policy approved by the team and linked from the epic |
| AICHAT-51 | Shared render and hook test helpers for the MFEs (`All MFEs`) | 2 | `renderWithClient` and `renderHookWithClient` (QueryClient with retries off) available to every MFE; Fake `EventSource` extracted from `ChatView.test.tsx` into a reusable helper; At least 3 existing tests migrated to the helpers |
| AICHAT-105 | shell: unit tests for every source file (`apps/shell`) | 5 | Logic: `app/queryClient.ts`, `features/auth-guard/api/useSession.ts`, `features/auth-guard/model/session.ts`, `features/remote-loader/model/loadRemote.ts`, `shared/http/constants.ts` tested incl. error paths; Components: `RemoteFallback.tsx`, `AppShellLayout.tsx`, `NavBar.tsx` (incl. theme toggle) have render-level tests; Route files without a test are tested or added to the exempt list; shell runs `vitest run --coverage` so its thresholds are enforced |
| AICHAT-69 | mfe-auth: unit tests for every source file (`apps/mfe-auth`) | 5 | Hooks `useLogin`, `useLogout`, `useRegister` tested for success, validation error and server error; `features/login/model.ts`, `features/register/model.ts`, `shared/schemas.ts` tested; `shared/components/AuthCard.tsx` has a render-level test; Indirect files with own logic (`shared/correlation.ts`, `shared/navigation.ts`) get focused tests; mfe-auth has coverage thresholds configured |
| AICHAT-87 | mfe-chat: unit tests for hooks, API client and SSE (`apps/mfe-chat`) | 5 | `app/use-media-query.ts`, `features/attachments/api/useUploadAttachment.ts`, `features/message-queue/hooks/useMessageQueue.ts` tested; `shared/api-client.ts`, `shared/auth.ts`, `shared/sse.ts` tested incl. error and reconnect paths; Indirect files with own logic (`features/chat-members/api/members.ts`, `app/auth-context.tsx`) get focused tests |
| AICHAT-126 | mfe-chat: render-level tests for untested components and pages (`apps/mfe-chat`) | 5 | `ChatDetailPage`, `ChatListPage`, `ChatWorkspace`, `MessageBubble`, `ReasoningSection`, `QueuedMessageItem` tested (render, props, main interaction, accessible names); `WebFetchList` tested incl. the `isWebUrl` guard on model-supplied URLs; The `src/app/**` coverage exclusion removed from mfe-chat |
| AICHAT-129 | mfe-chat: table-driven tests for model capability tables (`apps/mfe-chat`) | 3 | `it.each` over every `PROVIDER_MODELS` entry for reasoning, web fetch, vision, text and pdf; A model missing from a capability table fails the test |
| AICHAT-141 | mfe-settings: close the remaining unit-test gaps (`apps/mfe-settings`) | 1 | The file with no test and the indirectly tested file get focused unit tests (or an exempt entry with a reason); mfe-settings coverage thresholds still met |
| AICHAT-142 | auth-service: close the remaining unit-test gaps (`services/auth-service`) | 2 | `shared/contracts/http.ts` tested if it exports runtime values, otherwise exempted as type-only; The 3 indirectly tested files get focused tests where they have their own branching logic; auth-service coverage thresholds still met |
| AICHAT-123 | conversation-service: unit tests for controllers and shared helpers (`services/conversation-service`) | 5 | `shared/async-handler.ts` tested (resolved, rejected, thrown); `features/{attachments,chats,messages}/controller.ts` have focused tests for the request → service → response mapping; `shared/contracts/auth.ts` tested or exempted as type-only; Backend capability tables (`THINKING_STYLES`, `WEB_FETCH_TOOLS`, `VISION_MODEL_HINTS`) covered by table-driven tests |
| AICHAT-133 | Capability parity test between mfe-chat and conversation-service (`mfe-chat ↔ conversation-service`) | 5 | Parity test checks every model in `PROVIDER_MODELS` for reasoning, web fetch and vision; A mismatch between frontend and backend tables fails CI; Approach agreed (shared module or JSON export) if it requires moving the table |
| AICHAT-143 | Shared packages and tooling: close the remaining unit-test gaps (`packages/* and e2e`) | 3 | `packages/ui` `components/alert/alert.tsx` has a test; `packages/eslint-config` `base.js`, `node.js`, `react.js`, `local-plugin.js` tested by linting fixture files (`RuleTester`); `e2e/src/fixtures/wait-for-stack-cli.ts` tested (argument parsing, exit codes) |
| AICHAT-135 | Spike: evaluate MSW for HTTP mocking in the MFEs (`All MFEs`) | 2 | Decision recorded in the epic README; If adopted, handlers for auth, chats, messages and settings replace the hand-written `fetch` stubs |
| AICHAT-138 | Guard test for source files without unit tests (`All`) | 3 | Guard test in `packages/workspace-config` lists source files with the same rules as the inventory; Adding an untested file without an exempt entry fails CI |

Parallel plan: run AICHAT-36 (policy) in the main thread during the DoR review, then AICHAT-51 (helpers) first because the MFE stories use it. After that the per-project stories are independent: spawn **one agent per MFE / microservice** in parallel with `isolation: "worktree"` (shell, mfe-auth, mfe-chat ×3 in sequence inside one agent, mfe-settings, auth-service, conversation-service, packages). Each agent only gets its project's rows from the "Current state" loader (`awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-17/README.md | grep -E 'apps/<project>|services/<project>|^\| Project|^\|---'`). AICHAT-133 (parity) runs after AICHAT-129 and AICHAT-123; AICHAT-138 (guard) runs last.

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions in README or `docs/`
- [ ] Every non-exempt source file has a unit test (Jira: "hooks, utils and model capability tables covered")
- [ ] A guard test fails when a new source file has no test and isn't on the exempt list
- [ ] Meets the AICHAT-34 coverage thresholds
