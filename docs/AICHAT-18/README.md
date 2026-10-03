---
title: "AICHAT-18 · [Foundations] Component testing"
---

# AICHAT-18 · [Foundations] Component testing

| Field | Value |
|---|---|
| Jira | [AICHAT-18](https://ipca-grupo11.atlassian.net/browse/AICHAT-18) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Depends on | AICHAT-17 (shared test helpers; render-level unit tests of every other component), AICHAT-34 |
| Layer | Frontend (React components in isolation) |

## 1. Goal

Test the key React components (**Composer**, **ChatView**, **ProviderList**) in isolation for **render**,
**interaction** and **error** states, using Testing Library's user-centric queries.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** Composer, ChatView and ProviderList, with the state matrix in §4, confirmed in scope
- [ ] **Tooling agreed:** Vitest, Testing Library, user-event and a shared fake EventSource confirmed; `vitest-axe` adopted or rejected
- [ ] Target environment available
- [x] Testing Library set up (already in every app)
- [ ] States to cover listed per component → **§4 of this doc**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Composer, ChatView and ProviderList tested for render, interaction and error states

## 3. Technologies

| Tool | Version | Role |
|---|---|---|
| Vitest | `^5.0.1` | Runner (jsdom environment) |
| `@testing-library/react` | `^16.3.3` | `render`, role/label queries |
| `@testing-library/user-event` | `^14.6.7` | Realistic typing, clicks, keyboard |
| `@testing-library/jest-dom` | `^7.0.1` | `toBeDisabled`, `toHaveAccessibleName`, ... |
| jsdom | `^30.1.1` | DOM |
| Fake `EventSource` | in `ChatView.test.tsx` | SSE stand-in; currently a no-op |

Optional: **MSW** (see AICHAT-17-US10) and `vitest-axe` for an a11y assertion per component state (cheap complement to AICHAT-10).

## 4. Discovery: current state and gaps

### Composer: `apps/mfe-chat/src/features/composer/components/Composer.test.tsx` (5 tests)

| State | Covered? |
|---|---|
| Send clears input | ✅ |
| Send disabled on empty input | ✅ |
| Enter sends | ✅ |
| 500 → error alert | ✅ |
| Oversized attachment disables Send until removed | ✅ |
| **Sending state** (`isSending` → button `loading`) | ❌ |
| **Shift+Enter** inserts newline (does not send) | ❌ |
| **`compact` mode** | ❌ |
| **Image on non-vision model** warning | ❌ |
| **Queued response** (message queued while a stream runs) | ❌ |
| **`X-Llm-Api-Key` header** sent | ❌ |

### ChatView: `apps/mfe-chat/src/features/chat-view/components/ChatView.test.tsx` (11 tests)

| State | Covered? |
|---|---|
| Loaded render, Stop on streaming, Retry on failed, 403 → "not found" | ✅ |
| Reasoning / web-fetch toggles (owner, member, unsupported model) and persistence | ✅ |
| API key on retry | ✅ |
| **Loading skeleton** ("Loading chat…") | ❌ |
| **Non-404 error** ("Could not load this chat") | ❌ |
| **Messages error alert** | ❌ |
| **Live streaming** (tokens, reasoning, web fetch events) | ❌ (`FakeEventSource` emits nothing) |
| `onBack` / `onClose` buttons, `compact` mode | ❌ |
| Share/Members dialog opens | ❌ |
| Toggle loading state and failed toggle update | ❌ |

### ProviderList: `apps/mfe-settings/src/features/api-keys/components/ProviderList.test.tsx` (8 tests)

| State | Covered? |
|---|---|
| Render, save, remove, loading, signed-out/error, user isolation, "Re-enter key" | ✅ |
| **"Configured" / "Not configured" badge** assertions | ❌ |
| **Save fails** (storage error) | ❌ |
| Keyless "Local" branch | ⚠️ unreachable since Ollama was removed (`PROVIDERS_WITHOUT_KEY` is empty), so this is dead code to remove or ignore |

### Test utilities

- `apps/mfe-chat/src/test/utils.tsx`: `createTestQueryClient`, `withQueryClient`, `jsonResponse()`.
- `apps/mfe-auth` and `apps/mfe-settings` have identical copies of `renderWithQueryClient`, a candidate to move into a shared package.
- No MSW; `fetch` is stubbed by hand.

## 5. Implementation plan (steps)

1. Write the state matrix above as a checklist in each spec file (`describe` per state group: render / interaction / error).
2. Extract `FakeEventSource` into `apps/mfe-chat/src/test/fake-event-source.ts` with `emit(event, data)` / `fail()` helpers, so tests can push SSE events.
3. Composer: add the 6 missing states.
4. ChatView: add loading/error states; drive a stream through the fake EventSource (token → reasoning → web_fetch → done; and error mid-stream).
5. ProviderList: badges and failed save.
6. (Optional) Add one `axe` assertion per component in its main state.
7. Make sure the files count towards coverage (`src/app/**` is excluded in mfe-chat; the components are under `features/`, so they count).
8. Document how to run in this folder.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-37](https://ipca-grupo11.atlassian.net/browse/AICHAT-37) | AICHAT-18-US1 | As a developer, I want a reusable fake EventSource so that streaming components can be tested without a server | Helper with `emit`, `error`, `close`; used by ChatView and `useMessageStream` tests | 2 |
| [AICHAT-54](https://ipca-grupo11.atlassian.net/browse/AICHAT-54) | AICHAT-18-US2 | As a user, I want the Composer to behave correctly while sending, queueing and with attachments, so that I never lose a message | Tests for sending state, Shift+Enter, compact, non-vision warning, queued response, API key header | 3 |
| [AICHAT-72](https://ipca-grupo11.atlassian.net/browse/AICHAT-72) | AICHAT-18-US3 | As a user, I want ChatView to show loading, error and live-stream states correctly | Tests for skeleton, non-404 error, messages error, streamed tokens/reasoning/web fetch, mid-stream error, back/close, members dialog, toggle failure | 5 |
| [AICHAT-89](https://ipca-grupo11.atlassian.net/browse/AICHAT-89) | AICHAT-18-US4 | As a user, I want the Settings provider list to show whether a key is configured and to tell me when saving fails | Badge assertions and failed-save test | 2 |
| [AICHAT-107](https://ipca-grupo11.atlassian.net/browse/AICHAT-107) | AICHAT-18-US5 | (Optional) As a developer, I want an axe check per component state so that a11y regressions surface early | `vitest-axe` assertion in the main state of the 3 components | 2 |

## 7. Risks and open decisions

- Streaming tests can be flaky if they depend on timers; use `vi.useFakeTimers()` or `findBy*` queries, not sleeps.
- The "Local" keyless branch in ProviderList is unreachable: report it to the configuration owner instead of testing dead code.

## 8. Notes for the report

The three components named in the epic already have 24 tests between them, but they focus on the happy path.
Discovery found **17 missing states**, most importantly **live streaming in ChatView, which is never exercised**
because the fake `EventSource` is a no-op. The plan adds a controllable fake SSE source and a state matrix per component.
