---
name: aichat-31-secret-scanning
description: Run epic AICHAT-31 (Secret scanning) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-31", "work on AICHAT-31", "continue AICHAT-31".
---

# AICHAT-31 · [Foundations] Secret scanning

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-31. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-31 · [Foundations] Secret scanning |
| Branch | `test/AICHAT-31-secret-scanning` |
| Work log | `docs/AICHAT-31/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-31/evidence/` |
| Layer | Security, repository |
| Related | AICHAT-27 (SAST: Semgrep `p/secrets` overlaps) |

## Goal

No keys, passwords or tokens are committed. **gitleaks on every PR**, a **one-time scan of the full git history**,
**GitHub secret scanning** turned on, and **any leaked secret rotated**.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-31/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-31/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-31/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-31/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: PR diffs, the full git history (once) and the working tree confirmed in scope
2. Tooling agreed: gitleaks CLI/Docker or action (licence) chosen; GitHub secret scanning availability checked
3. Target environment available
4. gitleaks config with allow-list for test fixtures → fixtures listed in §4.2

Open decisions from the analysis (ask the ones not already settled):
  - **Licensing:** org repo → gitleaks-action licence (free key) or CLI; GitHub secret scanning paid on private repos.
  - Rewriting history breaks every clone and open PR; only do it if a secret can't be rotated.
  - The untracked `docs/CREDENTIALS.md` / `docs/ACCESS.md` must be checked before they are committed.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-44 | gitleaks config with a narrow allow-list | 2 | `.gitleaks.toml`; scan of current tree is clean; each allow-list entry has a comment |
| AICHAT-55 | One-off full git history scan | 2 | History report triaged; summary doc without secret values |
| AICHAT-73 | Rotate every leaked secret | 2 | Rotation checklist done for each real finding (or "none found" recorded) |
| AICHAT-91 | gitleaks on every PR, secrets block the merge | 2 | CI job; a test commit with a fake-but-valid-looking key fails |
| AICHAT-109 | Decide on GitHub secret scanning | 1 | Enabled (if licensed) or decision documented |
| AICHAT-124 | Pre-commit hook that blocks secrets locally | 1 | Hook documented; works on macOS/Linux |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] gitleaks on every PR
- [ ] Full git history scanned once
- [ ] GitHub secret scanning on
- [ ] Any leaked secret rotated
