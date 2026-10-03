---
name: aichat-18-component-testing
description: Run epic AICHAT-18 (Component testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-18", "work on AICHAT-18", "continue AICHAT-18".
---

# AICHAT-18 · [Foundations] Component testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-18. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-18 · [Foundations] Component testing |
| Branch | `test/AICHAT-18-component-testing` |
| Work log | `docs/AICHAT-18/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-18/evidence/` |
| Layer | Frontend (React components in isolation) |
| Depends on | AICHAT-17 (shared test helpers; render-level unit tests of every other component), AICHAT-34 |

## Goal

Test the key React components (**Composer**, **ChatView**, **ProviderList**) in isolation for **render**,
**interaction** and **error** states, using Testing Library's user-centric queries.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-18/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-18/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-18/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-18/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Composer, ChatView and ProviderList, with the state matrix in §4, confirmed in scope
2. Tooling agreed: Vitest, Testing Library, user-event and a shared fake EventSource confirmed; `vitest-axe` adopted or rejected
3. Target environment available
4. Testing Library set up (already in every app)
5. States to cover listed per component → §4 of this doc

Open decisions from the analysis (ask the ones not already settled):
  - Streaming tests can be flaky if they depend on timers; use `vi.useFakeTimers()` or `findBy*` queries, not sleeps.
  - The "Local" keyless branch in ProviderList is unreachable: report it to the configuration owner instead of testing dead code.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-37 | Reusable fake EventSource for component tests | 2 | Helper with `emit`, `error`, `close`; used by ChatView and `useMessageStream` tests |
| AICHAT-54 | Composer state tests (sending, queueing, attachments) | 3 | Tests for sending state, Shift+Enter, compact, non-vision warning, queued response, API key header |
| AICHAT-72 | ChatView state tests (loading, error, live stream) | 5 | Tests for skeleton, non-404 error, messages error, streamed tokens/reasoning/web fetch, mid-stream error, back/close, members dialog, toggle failure |
| AICHAT-89 | Settings provider list state tests | 2 | Badge assertions and failed-save test |
| AICHAT-107 | Accessibility (axe) check per component state | 2 | `vitest-axe` assertion in the main state of the 3 components |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Composer, ChatView and ProviderList tested for render, interaction and error states
