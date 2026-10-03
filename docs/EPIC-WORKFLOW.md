---
title: "Epic workflow (testing epics AICHAT-17 to AICHAT-34)"
---

# Epic workflow

How each testing epic is taken from **TODO** to **Done**: what happens in Jira, what is asked before work starts,
and how every step is documented so it can be repeated by someone else. The same procedure is used for all 19
epics listed in [AICHAT-EPICS.md](AICHAT-EPICS.md).

| Item | Value |
|---|---|
| Jira project | [AICHAT](https://ipca-grupo11.atlassian.net/jira/software/projects/AICHAT/list) |
| Owner of every epic and story | Jean-Pierre Carvalho |
| Board columns | TODO → In Progress → Review → Done |
| Execution order | [EPIC-PLAN.md](EPIC-PLAN.md) |
| Per-epic analysis | `docs/AICHAT-<n>/README.md` (goal, current state, plan, stories, risks) |
| Per-epic work log | `docs/AICHAT-<n>/WORKLOG.md` (what was done, how to run it, how to repeat it by hand, evidence) |
| Evidence (screenshots, logs, reports) | `docs/AICHAT-<n>/evidence/` |
| Work-log template | [templates/WORKLOG.md](templates/WORKLOG.md) |
| Terminal screenshot helper | [`scripts/evidence/term-shot.ts`](../scripts/evidence/term-shot.ts) |
| Integration branch | `integration/testing-epics` (all epic branches merge here; one final PR to `main`) |
| Epic branch | `test/AICHAT-<n>-<short-name>`, created from the integration branch |

## Overview

```
 ┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────────────┐   ┌──────────┐   ┌──────┐
 │ 1. Start │ → │ 2. DoR review│ → │ 3. Setup  │ → │ 4. Story loop    │ → │ 5. DoD   │ → │ Done │
 │ (Jira)   │   │ (questions)  │   │ (branch,  │   │ (build, run,     │   │ review & │   │      │
 │          │   │              │   │  worklog) │   │  document, PR)   │   │ report   │   │      │
 └──────────┘   └──────┬───────┘   └───────────┘   └──────────────────┘   └──────────┘   └──────┘
                       │ blocker not resolved
                       ▼
                 epic flagged "Impediment", stays In Progress, next epic is picked
```

## 1. Start the epic

1. Pick the next epic from [EPIC-PLAN.md](EPIC-PLAN.md) (dependencies first). Only **one epic In Progress at a time**.
2. In Jira, move the epic **TODO → In Progress** (transition *Em andamento*).
3. Check the epic and every child story are assigned to the owner.
4. Add a comment to the epic: `Started <date>. Work log: docs/AICHAT-<n>/WORKLOG.md`.

**Order**: follow [EPIC-PLAN.md](EPIC-PLAN.md) (waves, dependencies and the start command for every epic).

## 2. Definition of Ready review

Before any code is written, every DoR item of the epic is checked **with the owner**. Nothing is assumed.

1. Open the DoR list in the Jira epic and in §2 of `docs/AICHAT-<n>/README.md`.
2. For each item, mark it:
   - **Met**: evidence exists (link it).
   - **Needs a decision**: turn it into a concrete question with options and a recommendation
     (for example: *"Coverage threshold for the services: 70 %, 80 % or 90 % lines?"*).
   - **Blocked**: depends on someone else or on missing code (for example the deletion endpoint in AICHAT-33).
3. Ask the owner all open questions in one round. Typical questions:
   - Is the scope in the README still right, or should anything be added or removed?
   - Which tool/option do we use (when the README lists alternatives)?
   - What limits, thresholds or budgets do we agree on?
   - Which environment is used (local, CI, staging VM, production)?
   - Is a small change to application code allowed for testability?
   - Is there a cost (API keys, paid licences), and is it approved?
4. Record every answer in the **DoR review** table of the work log (date, question, answer, decided by).
5. Update Jira: tick the DoR items that are now met, and add a comment summarising the decisions.
6. If a blocker remains: set the epic's **Flagged = Impediment**, write what is missing in a comment, and move on
   to the next epic. The epic stays In Progress until the blocker is cleared.

## 3. Set up

Branching model:

```
main
 └── integration/testing-epics            ← final PR to main, reviewed by the team
      ├── test/AICHAT-34-coverage-thresholds
      ├── test/AICHAT-17-unit-testing
      └── … one branch per epic (already created and pushed)
```

```sh
git fetch origin
git switch test/AICHAT-<n>-<short-name>             # e.g. test/AICHAT-27-sast (exists on origin)
git merge origin/integration/testing-epics          # pick up epics merged since the branch was cut
mkdir -p docs/AICHAT-<n>/evidence
cp docs/templates/WORKLOG.md docs/AICHAT-<n>/WORKLOG.md
```

Fill in the header of the work log (epic, branch, start date) and the **Environment** section
(OS, Node, pnpm, Docker and tool versions: `node -v`, `pnpm -v`, `docker --version`, …).

## 4. Story loop

For every story of the epic, in order (US1, US2, …):

1. Move the story **TODO → In Progress** in Jira.
2. Do the work in small commits (`test(<scope>): …`, `ci(<scope>): …`, `docs(<scope>): …`; reference the story key
   in the body, e.g. `Refs: AICHAT-35`).
3. **Run it** and capture evidence:
   - Terminal output → `node scripts/evidence/term-shot.ts --out docs/AICHAT-<n>/evidence --name <nn>-<what> -- <command>`
     (writes `<name>.log` and a `<name>.png` screenshot; the exit code is kept, so failing runs can be captured too).
   - Browser pages (Grafana, GitHub Actions, Jira, the app) → screenshot saved as `docs/AICHAT-<n>/evidence/<nn>-<what>.png`
     (Chrome DevTools *Capture screenshot*, or Playwright `page.screenshot()`).
   - Reports produced by the tool (HTML, SARIF, JSON, coverage) → copied to `evidence/` when small, otherwise linked
     to the CI artifact.
   - Number files in the order they happen (`01-`, `02-`, …) so the folder reads like the story.
4. **Document it** in the work log, in the story's section:
   - *What* was done and *why* (decision, alternatives rejected).
   - *Files* added or changed.
   - *How to run* (one command, from the repo root).
   - *How to repeat it manually*, step by step, from a clean checkout, with the expected output.
   - *Result*: numbers (tests, findings, coverage, timings) and the evidence images.
   - *Problems* hit and how they were solved.
5. Tick the acceptance criteria in the Jira story; push and open a PR from the epic branch into
   `integration/testing-epics` (`AICHAT-<n>: <summary>`), link the PR in the story.
6. As soon as the PR checks pass, merge it into `integration/testing-epics` (merge commit, branch kept) and move
   the stories to **Done**. Team review happens once, on the final PR to `main` (§6).

A failing check that is **expected** (a deliberate drop in coverage, a planted fake secret, a bundle over its limit)
is captured as evidence too: it proves the gate works.

## 5. Close the epic

1. Go through the DoD list of the epic; each item gets a link to its evidence in the work log's **DoD check** table.
2. Write the **Notes for the report** section of the work log: what was found, what was fixed, numbers, lessons learned.
3. Add the run instructions to `docs/AICHAT-<n>/README.md` (or link the work log) and update the status column in
   [AICHAT-EPICS.md](AICHAT-EPICS.md).
4. Make sure every PR of the epic is merged into `integration/testing-epics`.
5. Jira: epic **In Progress → Review** with a comment linking the work log and the PRs; **Review → Done** once the
   DoD is accepted.

## 6. Final merge to main

When all epics are merged (or explicitly left out), one PR `integration/testing-epics → main` is opened and the
team is asked for review. Before opening it: `git merge origin/main` into the integration branch, run the full test
suite, and list every epic with its work log in the PR description.

## Conventions for the documentation

- Written for a reader who has the repository and nothing else: every command is copy-pasteable from the repo root.
- Present tense for how things work, past tense for what was done ("We added …", "The baseline run found …").
- No secrets in documentation or screenshots: crop or blur tokens, keys and emails before saving an image.
- Images are referenced with relative paths, so the folder can be moved to another repository unchanged:
  `![Semgrep baseline](evidence/01-semgrep-baseline.png)`.
- Commit messages and PR descriptions follow Conventional Commits and only describe the change.
