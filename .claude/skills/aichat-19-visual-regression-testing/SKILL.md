---
name: aichat-19-visual-regression-testing
description: Run epic AICHAT-19 (Visual regression testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-19", "work on AICHAT-19", "continue AICHAT-19".
---

# AICHAT-19 · [Foundations] Visual regression testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-19. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-19 · [Foundations] Visual regression testing |
| Branch | `test/AICHAT-19-visual-regression-testing` |
| Work log | `docs/AICHAT-19/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-19/evidence/` |
| Layer | Frontend (pixels of key screens) |
| Depends on | AICHAT-4 (E2E harness, João Delgado); full stack in CI (`e2e.yml`) |

## Goal

Catch unintended visual changes on the key screens, in **light and dark** themes, by comparing Playwright
screenshots against committed baselines. A diff fails CI.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-19/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-19/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-19/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-19/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: 9 key screens × light/dark at a desktop viewport (§4.4) confirmed in scope
2. Tooling agreed: Playwright `toHaveScreenshot` run in the Playwright Docker image confirmed; font strategy chosen (self-host vs intercept)
3. Target environment available
4. Key screens listed → §4.3
5. Fixed fonts and data for stable rendering → not met today, see §4.2

Open decisions from the analysis (ask the ones not already settled):
  - **Self-hosting fonts is an app change** (shell `index.html`/CSS). Alternative: route-intercept the font requests only in tests.
  - Baselines must be generated on Linux (CI OS); macOS renders differ. Always use the Docker image.
  - Theme toggle lives in the shell; remotes inherit via the `dark` class on `<html>`, so one switch covers all remotes.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-39 | Deterministic fonts and test data for screenshots | 3 | Fonts load without network; API mocks + frozen clock; 10 runs in a row produce identical images |
| AICHAT-56 | Playwright visual project and screenshot settings | 1 | Project in `playwright.config.ts` with thresholds, path template, viewport |
| AICHAT-74 | Visual baselines for 9 key screens (light and dark) | 5 | 18 committed PNG baselines produced in the Playwright Docker image |
| AICHAT-92 | Fail CI on visual diffs and attach diff images | 2 | CI job fails on diff; `test-results` diff PNGs uploaded as an artifact |
| AICHAT-110 | Document the baseline update procedure | 1 | `docs/AICHAT-19/RUNNING.md` with Docker update command and review checklist |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Baselines for each screen in light and dark
- [ ] `toHaveScreenshot` diffs fail CI
