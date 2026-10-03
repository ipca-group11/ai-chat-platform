---
title: "AICHAT-31 · Git history scan: summary"
---

# AICHAT-31 · One-off git history scan

Date: 2026-10-03. Tool: gitleaks 8.28.0 with `.gitleaks.toml` (default rules). No secret value appears in this document; all runs used `--redact`. The raw JSON reports were written outside the repository and are not committed.

## Scope

| Item | Value |
|---|---|
| Refs | all local branches and `origin/*` remote branches (`--log-opts='--all -m'`) |
| Commits in the repository | 45 (4 of them merges) |
| Commits scanned by gitleaks | 43 (the other 2 have no textual diff to scan) |
| Command | `gitleaks git . --redact --log-opts='--all -m' -f json -r <report outside the repo>` |

## Result

| Metric | Value |
|---|---|
| Findings in history | 0 |
| Real secrets | 0 |
| False positives | 0 |

Triage table (one row per finding, none to list):

| Rule | File | Commit | Date | Secret type | Verdict |
|---|---|---|---|---|---|
| none | — | — | — | — | — |

## Related check: `.env.credentials`

The local file `.env.credentials` is git-ignored (`.gitignore` line 11). `git log --all -- .env.credentials` returns no commit, so it was never committed. A scan of the working tree reports 7 findings in that file (rule `generic-api-key`). They are real credentials for the deployed environment that live only on the owner's machine. They are recorded in the work log and not rotated (owner decision).

## Evidence

- `evidence/03-history-scan.log`
- `evidence/04-credentials-never-committed.log`
