---
name: aichat-27-sast
description: Run epic AICHAT-27 (SAST) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-27", "work on AICHAT-27", "continue AICHAT-27".
---

# AICHAT-27 · [Foundations] SAST

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-27. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-27 · [Foundations] SAST |
| Branch | `test/AICHAT-27-sast` |
| Work log | `docs/AICHAT-27/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-27/evidence/` |
| Layer | Security, source code |
| Related | AICHAT-31 (secret scanning), AICHAT-28 (DAST), AICHAT-29 (pentest) |

## Goal

Run **static application security testing** on every PR; **high-severity findings block the merge**; findings that
already exist are fixed or waived with a reason.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-27/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-27/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-27/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-27/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: All TS/JS, Dockerfiles and GitHub Actions workflows confirmed in scope; generated code excluded
2. Tooling agreed: Semgrep CE or CodeQL chosen (private-repo licence checked)
3. Target environment available
4. Tool chosen (CodeQL or Semgrep) → recommendation in §3

Open decisions from the analysis (ask the ones not already settled):
  - Private-repo licensing (CodeQL/SARIF upload) → Semgrep CE with artifacts.
  - False positives: start with ERROR-only blocking and review WARNINGs weekly.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-35 | Choose the SAST tool and record the decision | 1 | Decision recorded (Semgrep CE vs CodeQL, private-repo licensing) |
| AICHAT-50 | Semgrep configuration with rule packs and custom rules | 3 | `.semgrep.yml` + `.semgrepignore`; local run documented |
| AICHAT-68 | Triage existing SAST findings | 3 | All baseline findings fixed or waived in `WAIVERS.md` with reasons; JWT default secret ticketed as High |
| AICHAT-86 | SAST on every PR, high findings block the merge | 2 | `security.yml` job; ERROR findings fail; required check on `main` |
| AICHAT-103 | Readable SAST results in the PR | 1 | Job summary table + SARIF artifact |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs on every PR; high findings block the merge
- [ ] Existing findings fixed or waived
- [ ] Run instructions documented
