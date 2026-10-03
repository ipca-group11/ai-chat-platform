---
title: "AICHAT-34 · Coverage thresholds: work log"
---

# AICHAT-34 · Coverage thresholds: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-34](https://ipca-grupo11.atlassian.net/browse/AICHAT-34) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-34-coverage-thresholds` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Are the 15 test projects of README §4 in scope? | Yes, the 15 projects; `testing/k6` exempt (k6 runtime, not Node) | Owner |
| Tooling agreed | Met | Which coverage tool? | Vitest coverage-v8 through the `@platform/test-config` preset | Owner |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions (`ci.yml`) | Owner |
| Line/branch minimum per project | Met | Which thresholds (lines/branches/functions/statements)? | `services/*` and `packages/*` 80/80/80/80; `apps/mfe-*` and `apps/shell` 80/75/80/80; `e2e` helpers 80/70/80/80 | Owner |
| Projects below the threshold | Met | Fail CI now or ratchet? | Ratchet: threshold set at the current value rounded down with a dated TODO, raised by AICHAT-17/18 | Owner |

Blockers: none / …

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | Darwin 25.3 | — |
| Node | `node -v` → v24.9.0 | `.nvmrc` |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → 29.4.0 | Docker Desktop |

![Environment](evidence/00-environment.png)

## 3. Steps

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
