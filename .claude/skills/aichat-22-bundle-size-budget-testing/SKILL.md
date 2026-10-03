---
name: aichat-22-bundle-size-budget-testing
description: Run epic AICHAT-22 (Bundle size budget testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-22", "work on AICHAT-22", "continue AICHAT-22".
---

# AICHAT-22 · [Foundations] Bundle size budget testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-22. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-22 · [Foundations] Bundle size budget testing |
| Branch | `test/AICHAT-22-bundle-size-budget-testing` |
| Work log | `docs/AICHAT-22/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-22/evidence/` |
| Layer | Frontend build output (Module Federation) |
| Related | AICHAT-21 (performance) |

## Goal

Each micro-frontend's `remoteEntry.js` and its chunks stay below an agreed size limit. Going over the limit fails CI.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-22/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-22/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-22/README.md` |
| Proposed limits (to agree, DoR), gzip | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-22/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-22/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Shell + 3 remotes confirmed in scope: `remoteEntry.js`, exposed-module chunks, shared fallbacks
2. Tooling agreed: size-limit with `@size-limit/file` as an Nx `size` target confirmed
3. Target environment available
4. Size limits agreed per remote → proposal in §5

The proposal to put in front of the owner is in README "Proposed limits (to agree, DoR), gzip".
Open decisions from the analysis (ask the ones not already settled):
  - Hashed chunk names change each build; use globs, not file names.
  - Federation fallback chunks inflate "total" numbers. Decide whether limits apply to "runtime-loaded" or "all emitted" files (recommendation: both, with a looser total).

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-47 | Agree bundle size limits per remote | 1 | Limits recorded here with the measured baseline |
| AICHAT-65 | Nx size target for remoteEntry.js and chunks | 3 | size-limit config for shell + 3 remotes; target passes on `main` |
| AICHAT-83 | Fail CI when a bundle exceeds its limit | 2 | `size` in `nx affected` targets; a deliberate +50 KB import fails the job |
| AICHAT-101 | Show bundle size change on each PR | 2 | PR comment or job summary with before/after per file |
| AICHAT-119 | Verify shared dependencies load once at runtime | 2 | Network-request check on `/chats`; result recorded; mismatch reported |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] size-limit checks every `remoteEntry.js` and chunk
- [ ] Going over the limit fails CI
