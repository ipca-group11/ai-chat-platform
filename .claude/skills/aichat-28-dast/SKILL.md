---
name: aichat-28-dast
description: Run epic AICHAT-28 (DAST) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-28", "work on AICHAT-28", "continue AICHAT-28".
---

# AICHAT-28 · [Foundations] DAST

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-28. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-28 · [Foundations] DAST |
| Branch | `test/AICHAT-28-dast` |
| Work log | `docs/AICHAT-28/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-28/evidence/` |
| Layer | Security, running application |
| Related | AICHAT-27 (SAST), AICHAT-29 (pentest), unassigned "Security header / TLS testing" |

## Goal

Scan the **running stack** for OWASP Top 10 issues (headers, cookies, information disclosure, …) with the
**OWASP ZAP baseline** scan. **High alerts fail** the job; known false positives are listed in a **rules file**.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-28/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-28/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-28/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-28/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Local compose stack in CI confirmed as the target (shell + APIs); production excluded unless approved; passive vs active scan decided
2. Tooling agreed: ZAP baseline (`zaproxy/action-baseline`), `rules.tsv` and AJAX spider confirmed
3. Target environment available
4. A running stack reachable from CI → yes: `e2e.yml` already starts `compose.yaml` on the runner

Open decisions from the analysis (ask the ones not already settled):
  - Active scans can create data and be slow; keep active scanning weekly and **never against production without approval**.
  - SPA crawling needs the AJAX spider, since the classic spider sees almost nothing in a React app.
  - The legacy `docker-compose.yml` exposes Postgres and Grafana on all interfaces with default passwords. Recommend removing it.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-52 | ZAP rules file, severity policy and false positives | 1 | `testing/zap/rules.tsv` with reasons for each IGNORE |
| AICHAT-71 | Authenticated ZAP scan of pages and APIs | 3 | Seeded user + cookie injection; report shows `/chats`, `/settings`, `/api/chats` URLs |
| AICHAT-90 | ZAP baseline in CI, high alerts fail the job | 2 | CI job with `fail_action`; reports as artifacts; required check |
| AICHAT-106 | Ticket missing security headers | 2 | First-run triage; Caddyfile header fixes ticketed to the deploy owner |
| AICHAT-121 | Weekly API scan from the OpenAPI spec | 3 | `zap-api-scan.py` weekly job (depends on AICHAT-12 spec) |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge or deploy
- [ ] Run instructions documented
- [ ] ZAP baseline runs against the stack
- [ ] High alerts fail
- [ ] False positives listed in a rules file
