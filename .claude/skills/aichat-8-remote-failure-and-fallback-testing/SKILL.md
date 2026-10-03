---
name: aichat-8-remote-failure-and-fallback-testing
description: Run epic AICHAT-8 (Remote failure and fallback testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-8", "work on AICHAT-8", "continue AICHAT-8".
---

# AICHAT-8 · [Foundations] Remote failure and fallback testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-8. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-8 · [Foundations] Remote failure and fallback testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-8-remote-failure-fallback` |
| Work log | `docs/AICHAT-8/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-8/evidence/` |
| Layer | Frontend, Module Federation (shell + 3 remotes) |
| Related | AICHAT-19 (visual regression of the fallback UI), AICHAT-10 (fallback must be accessible) |

## Goal

When any of the three remotes (`mfeAuth`, `mfeChat`, `mfeSettings`) fails or is slow, the shell shows a **scoped fallback**
for that remote only, the **rest of the app keeps working**, and **Retry** recovers it without a page reload.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-8/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-8/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-8/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-8/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: Playwright `page.route` per remote origin; abort, HTTP 500 and delay modes
2. Target environment available (local compose stack and the `e2e.yml` CI stack)
3. Error boundary / fallback UI exists in the shell for each remote → confirmed in §4.1

Open decisions from the analysis (ask the ones not already settled):
  - **Load timeout:** add one to `createRemoteRoute` (small app change) or accept an endless skeleton for a hung remote.
  - Replace the old US-9 block in `e2e/src/tests/shell.spec.ts` or keep it and make it reuse the helper.

## Stories (run one subagent per story, in this order)

US1 first (helper used by all). US2–US5 can run in parallel after US1 (separate spec blocks). US6 last.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-161 | Playwright helper to block or delay a single remote | 2 | `failRemote(page, remote, mode)` supports abort, delay and HTTP 500 for mfeAuth, mfeChat and mfeSettings; matches only that remote's origin (VITE_MFE_*_URL), not every remoteEntry; URL matcher has a Vitest unit test |
| AICHAT-162 | Each remote blocked in turn shows its scoped fallback | 3 | Parameterised spec blocks each remote in turn; `RemoteFallback` (alert + Retry) and NavBar visible; the other two remotes' routes still work in the same session; abort and 500 both covered |
| AICHAT-163 | Slow remote shows the loading skeleton, then the content | 2 | Each remote delayed: `remote-loading-<scope>` visible, then content, no fallback; decision recorded for a remote that never answers (assert fallback after timeout if one is added) |
| AICHAT-164 | Retry recovers a remote once it is back online | 2 | E2E: block, fallback, unblock, Retry → remote renders without navigation; unit test for `createRemoteRoute.tsx` retry calls the loader again; Retry while still down shows the fallback again |
| AICHAT-165 | Remote chunk failure after remoteEntry has loaded | 3 | remoteEntry allowed, route chunk blocked → fallback, no error overlay; mid-session outage behaviour recorded and asserted; `[remote-loader]` console error with scope name checked |
| AICHAT-166 | Remote failure suite as a merge gate in the e2e workflow | 1 | Specs in `e2e/src/tests/remote-failure.spec.ts`; old US-9 block replaced or reuses the helper; runs in `e2e.yml` and blocks the merge; run instructions in `e2e/README.md` |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Playwright blocks and delays each of the 3 remotes in turn
- [ ] Fallback shown and the other routes still work
