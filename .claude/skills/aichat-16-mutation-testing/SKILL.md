---
name: aichat-16-mutation-testing
description: Run epic AICHAT-16 (Mutation testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-16", "work on AICHAT-16", "continue AICHAT-16".
---

# AICHAT-16 · [Foundations] Mutation testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-16. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-16 · [Foundations] Mutation testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-16-mutation` |
| Work log | `docs/AICHAT-16/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-16/evidence/` |
| Layer | Test quality: services and shared packages |
| Depends on | AICHAT-34 (coverage thresholds, JP) |
| Related | AICHAT-17 (unit testing, JP) |

## Goal

**Stryker** runs on the chosen projects with an agreed **mutation score threshold**, surviving mutants in core logic are
killed or justified, and the run is a **scheduled job**, not a merge gate.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-16/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-16/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-16/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-16/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: StrykerJS + Vitest runner, incremental mode (Recommended)
2. Target environment: local; GitHub runner for the schedule
3. Coverage thresholds epic in place: AICHAT-34 status (if not done, proceed with conversation-service only and note it)
4. Target projects: conversation-service + auth-service + shared-types (Recommended) / fewer

Open decisions from the analysis (ask the ones not already settled):
  - Thresholds: start at `high 80 / low 60 / break 50` and tune after the baseline (Recommended).
  - Stryker Vitest runner vs Vitest 5 compatibility: pin versions or fall back to the command runner.

## Stories (run one subagent per story, in this order)

US1 in the main thread. US2 → US3 (US3 reuses the base config). US4 after both baselines. US5 last.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-205 | Choose target projects and agree mutation score thresholds | 1 | Targets chosen (e.g. conversation-service queue/messages/llm-adapters, auth-service session/jwt, shared-types); high/low/break per target; AICHAT-34 dependency confirmed |
| AICHAT-206 | Stryker set up for conversation-service | 3 | `@stryker-mutator/core` + `@stryker-mutator/vitest-runner`; mutate globs exclude test-utils, Prisma client and types; Nx `mutate` target with incremental mode; HTML + JSON reports; baseline per folder |
| AICHAT-207 | Stryker set up for auth-service and shared-types | 3 | Shared Stryker base config (e.g. `packages/test-config`) so projects only set globs and thresholds; `mutate` target in both; baselines recorded; run time per project measured |
| AICHAT-208 | Kill or justify the surviving mutants in core logic | 5 | Survivors triaged in queue, messages/processor, llm-adapters, session/jwt, shared-types schemas; stronger assertions kill them; equivalent mutants disabled inline with a reason; each target reaches its threshold; before/after scores in the WORKLOG |
| AICHAT-209 | Scheduled mutation workflow with published reports | 2 | `mutation.yml` weekly cron + workflow_dispatch, not a merge gate; HTML reports as artifacts; job fails only below break; run instructions (local and CI) in README or `docs/` |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Runs as a scheduled job and passes on `main`
- [ ] Run instructions added to the project README or `docs/`
- [ ] Stryker runs on the chosen projects
- [ ] Mutation score threshold set
- [ ] Scheduled job, not a merge gate
