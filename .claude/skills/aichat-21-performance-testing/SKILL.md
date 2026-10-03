---
name: aichat-21-performance-testing
description: Run epic AICHAT-21 (Performance testing (frontend)) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-21", "work on AICHAT-21", "continue AICHAT-21".
---

# AICHAT-21 · [Foundations] Performance testing (frontend)

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-21. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-21 · [Foundations] Performance testing (frontend) |
| Branch | `test/AICHAT-21-performance-testing` |
| Work log | `docs/AICHAT-21/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-21/evidence/` |
| Layer | Frontend (Core Web Vitals) |
| Related | AICHAT-22 (bundle size), observability (Faro + Grafana) |

## Goal

Keep each page within agreed **Core Web Vitals** budgets: **LCP** (Largest Contentful Paint), **INP** (Interaction to
Next Paint), **CLS** (Cumulative Layout Shift). Use **Lighthouse CI** in the pipeline (lab data) and **Grafana Faro** in
production (field / real-user data).

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-21/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-21/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-21/README.md` |
| Proposed budgets (to agree, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-21/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-21/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: 5 pages confirmed in scope: `/login`, `/register`, `/chats`, `/chats/:id`, `/settings`
2. Tooling agreed: Lighthouse CI for lab data (TBT as INP proxy) and Faro/Grafana for field data confirmed
3. Target environment available
4. LCP / INP / CLS budgets agreed per page → proposal in §5

The proposal to put in front of the owner is in README "Proposed budgets (to agree, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - **INP can't be measured by Lighthouse navigation runs.** TBT is used as the CI proxy; INP is only checked from Faro field data.
  - CI runners are noisy: use median of 3 runs and some margin; consider `assert` as `warn` first, then `error` once stable.
  - Authenticated pages need a seeded user; reuse the `e2e/src/fixtures/test-users.ts` approach.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-45 | Agree LCP/INP/CLS budgets per page | 1 | Budgets table approved and recorded here |
| AICHAT-62 | Lighthouse CI audit for every page, including logged-in pages | 3 | `lighthouserc.cjs` + login script; 5 URLs audited ×3 runs locally |
| AICHAT-80 | Fail CI when a page exceeds its budget | 3 | LHCI job in GitHub Actions with assertions; reports kept as an artifact; failing assertion fails the job |
| AICHAT-98 | Real-user Web Vitals per page in Grafana | 2 | Faro dashboard shows LCP/INP/CLS p75 from the VM, broken down by page; documented with a screenshot |
| AICHAT-115 | Performance improvements list from the first audit | 2 | Findings list (shared deps, fonts, preloading) linked to follow-up tickets |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Lighthouse CI checks every page against the budgets
- [ ] Faro real-user vitals visible in Grafana
