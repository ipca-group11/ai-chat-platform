---
name: aichat-10-accessibility-testing
description: Run epic AICHAT-10 (Accessibility testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-10", "work on AICHAT-10", "continue AICHAT-10".
---

# AICHAT-10 · [Foundations] Accessibility testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-10. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-10 · [Foundations] Accessibility testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-10-accessibility` |
| Work log | `docs/AICHAT-10/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-10/evidence/` |
| Layer | Frontend: shell + 3 MFEs + `packages/ui` |
| Related | AICHAT-18 (component tests), AICHAT-19 (visual regression, same page × theme matrix) |

## Goal

Every page, in **light and dark** theme, is scanned with **axe-core** on every PR with **zero serious/critical violations**,
and the main flows work **with the keyboard only**.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-10/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-10/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-10/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-10/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: axe-core via Playwright, WCAG 2.2 AA tags, serious + critical blocking (Recommended)
2. Target environment available (compose stack, `e2e.yml`)
3. Pages and themes to check: the §4.2 matrix in light + dark (Recommended) / reduced set
4. `@axe-core/playwright` installed → confirmed (`^4.10.1`)

Open decisions from the analysis (ask the ones not already settled):
  - The live streaming message: scan after the stream ends (Recommended) or exclude it with a reason.
  - Do the vitest-axe spike (US5) or skip it.

## Stories (run one subagent per story, in this order)

US1 in the main thread. US2 → US3 (fixes depend on the baseline). US4 in parallel with US3. US5 optional, any time.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-172 | List the pages, states and themes to audit | 1 | Pages listed (/login, /register, /chats empty + with chats, /chats/:id history/streaming/error/attachments/members dialog, /settings, remote fallback); each in light and dark; WCAG 2.2 AA and blocking impacts confirmed |
| AICHAT-173 | axe-core scan of every page in light and dark theme | 5 | `e2e/src/tests/accessibility.spec.ts` over page × theme; uses `assertNoCriticalA11yViolations` from `e2e/src/a11y/axe-helper.ts`; zero serious/critical; axe JSON uploaded as CI artifact; runs in e2e.yml and blocks the merge |
| AICHAT-174 | Fix the accessibility violations found by the scan | 5 | Baseline triaged in a table (rule, page, theme, impact, owner); serious/critical fixed at the source, `packages/ui` first; any disabled rule/excluded selector has a reason and a follow-up issue |
| AICHAT-175 | Keyboard navigation, focus and live-region checks | 3 | Login, register, create chat, send, Stop usable with Tab/Enter/Escape only; dialogs trap focus and return it; focus ring visible in both themes; streaming status is a polite live region, reply announced once |
| AICHAT-176 | Spike: component-level a11y checks with vitest-axe | 2 | Decision recorded in the epic README; if adopted, toHaveNoViolations on Button, Input, Dialog, Alert, Select |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] axe-core runs on every page, light and dark
- [ ] Zero serious/critical violations
