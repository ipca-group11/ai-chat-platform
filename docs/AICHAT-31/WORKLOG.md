---
title: "AICHAT-31 · Secret scanning: work log"
---

# AICHAT-31 · Secret scanning: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-31](https://ipca-grupo11.atlassian.net/browse/AICHAT-31) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-31-secret-scanning` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Are PR diffs, the full git history (once) and the working tree in scope? | Yes, all three | Owner |
| Tooling agreed | Met | Which scanner? (plan decision D4) | gitleaks CLI in GitHub Actions (no licence key needed) plus a local pre-commit hook | Owner |
| Target environment available | Met | Where does it run? | Locally (gitleaks installed with Homebrew) and in GitHub Actions | Owner |
| GitHub secret scanning | Met | Enable it on the private org repo? | Not licensed (needs GitHub Advanced Security); decision documented in AICHAT-109, gitleaks covers the gap | Owner |
| Handling of real findings | Met | Rotate, rewrite history, or record? | Record each finding (redacted, no secret values) in the evidence; no history rewrite | Owner |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| gitleaks | `gitleaks version` → … | `brew install gitleaks` |

## 3. Steps

### US1 · <story summary> ([AICHAT-<key>](https://ipca-grupo11.atlassian.net/browse/AICHAT-<key>))

**What and why.** …

**Files.**
- `path/to/file` (new): …

**How to run.**

```sh
<one command from the repo root>
```

**How to repeat it manually.**

1. …
2. …
3. Expected output: …

**Result.** …

![<caption>](evidence/01-<what>.png)

**Problems and fixes.** …

### US2 · …

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| … | … | … |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
