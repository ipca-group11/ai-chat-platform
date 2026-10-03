---
name: aichat-29-penetration-testing
description: Run epic AICHAT-29 (Penetration testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-29", "work on AICHAT-29", "continue AICHAT-29".
---

# AICHAT-29 · [Foundations] Penetration testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-29. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-29 · [Foundations] Penetration testing |
| Branch | `test/AICHAT-29-penetration-testing` |
| Work log | `docs/AICHAT-29/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-29/evidence/` |
| Related | AICHAT-26, 27, 28 (automated security tests feed the pentest), unassigned "Authorization / IDOR testing" |

## Goal

A **manual, time-boxed attack** of the deployed app within written **rules of engagement**, producing a **report
with findings and severities** in `docs/`. High findings are fixed or ticketed.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-29/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-29/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-29/README.md` |
| Rules of engagement (draft, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-29/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-29/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: In/out-of-scope targets per §5 confirmed
2. Tooling agreed: Burp/ZAP, jwt_tool, ffuf and testssl.sh confirmed; WSTG/ASVS checklist and CVSS version chosen
3. Target environment available
4. Time box, scope and rules of engagement written → draft in §5

The proposal to put in front of the owner is in README "Rules of engagement (draft, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - Production is a single shared 4 GB VM, so testing can degrade it. Prefer staging.
  - Academic context: confirm if the course requires supervisor approval for attacking a cloud resource (Azure's policy allows testing your own resources without prior notice, within the rules of engagement).

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-38 | Written rules of engagement for the pentest | 1 | RoE with scope, time box, accounts, stop conditions; approved |
| AICHAT-49 | Staging environment identical to production | 2 | Temporary VM with the same compose, seeded test data |
| AICHAT-67 | Test authentication and authorisation (H1-H5) | 5 | Each hypothesis confirmed or refuted with evidence |
| AICHAT-85 | Test uploads, public endpoints, browser security and LLM risks (H6-H11) | 5 | Each hypothesis confirmed or refuted with evidence |
| AICHAT-104 | Pentest report with CVSS severities | 3 | `REPORT.md` in `docs/AICHAT-29/` |
| AICHAT-122 | Fix or ticket High findings and retest | 2 | Tickets linked to the epic; retest results in the report |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Run instructions / methodology documented
- [ ] Report with findings and severity in `docs/`
- [ ] High findings fixed or ticketed
