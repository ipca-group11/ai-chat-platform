---
name: aichat-34-coverage-thresholds
description: Run epic AICHAT-34 (Coverage thresholds) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-34", "work on AICHAT-34", "continue AICHAT-34".
---

# AICHAT-34 · [Foundations] Coverage thresholds

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-34. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-34 · [Foundations] Coverage thresholds |
| Branch | `test/AICHAT-34-coverage-thresholds` |
| Work log | `docs/AICHAT-34/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-34/evidence/` |
| Layer | Test quality |

## Goal

Every project has **Vitest coverage thresholds** (line and branch minimum agreed per project), and **going below the
threshold fails CI**.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-34/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-34/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-34/README.md` |
| Thresholds (proposal, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-34/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-34/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: The 15 test projects in §4 confirmed in scope (k6 exempt)
2. Tooling agreed: Vitest coverage-v8 through the `@platform/test-config` preset confirmed
3. Target environment available
4. Line/branch minimum agreed per project → proposal §5 (STACK.md decision #6 already sets 80%)

The proposal to put in front of the owner is in README "Thresholds (proposal, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - Turning enforcement on in shell/ui/mfe-auth may **break CI immediately** if they are below 80%, hence measure first and use the ratchet.
  - Coverage is necessary but not sufficient; mutation testing (AICHAT-16, João Vieira) builds on this.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-63 | Agree coverage thresholds and ratchet policy | 1 | §5 approved; current values of shell/ui/mfe-auth/e2e measured and recorded |
| AICHAT-81 | Shared coverage preset in every project | 3 | All 14 Node test projects import `@platform/test-config`; duplicates removed |
| AICHAT-100 | Enforce coverage in shell, ui, mfe-auth and e2e | 2 | `--coverage` + thresholds in all four; CI green |
| AICHAT-118 | Guard test for test targets that skip coverage | 2 | Test in `packages/workspace-config`; exempt list documented (k6) |
| AICHAT-132 | Coverage report on each PR and proof that a drop fails CI | 2 | Job summary with coverage per affected project; failing-PR proof linked here |
| AICHAT-139 | Narrow coverage excludes | 1 | mfe-chat `src/app/**` exclude narrowed; numbers recorded |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Vitest coverage thresholds set in every project
- [ ] Going below the threshold fails CI
