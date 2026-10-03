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

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | Darwin 25.3 | — |
| Node | `node -v` → v24.9.0 | `.nvmrc` |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → 29.4.0 | Docker Desktop |

![Environment](evidence/00-environment.png)

## 3. Steps

### US1 · Agree coverage thresholds and ratchet policy ([AICHAT-63](https://ipca-grupo11.atlassian.net/browse/AICHAT-63))

**What and why.** Before turning enforcement on we needed to know how much coverage `apps/shell`, `packages/ui`, `apps/mfe-auth` and `e2e` have today, because nobody computed it in CI. We measured each project and agreed the thresholds and the ratchet policy with the owner (README §5, approved 2026-10-03).

**Files.**
- `docs/AICHAT-34/README.md` (§5 approved, measured values added)
- `docs/AICHAT-34/evidence/01-before-shell.*` to `04-before-e2e.*`

**How to run.**
```sh
cd apps/shell && pnpm exec vitest run --coverage --coverage.reporter=text-summary
```
Same command in `packages/ui`, `apps/mfe-auth` and `e2e`.

**How to repeat it manually.**
1. Clean checkout of the branch, then `pnpm install`.
2. `cd apps/shell` and run the command above. Expected: a "Coverage summary" block; shell prints lines 70.51 % and exits 1 because its 80 % thresholds are not met.
3. Repeat in `packages/ui`, `apps/mfe-auth`, `e2e`. Expected: exit 0 and the numbers in the Result table.

**Result.**

| Project | Lines | Branches | Functions | Statements | Meets target |
|---|---|---|---|---|---|
| `apps/shell` | 70.51 | 60.97 | 62.12 | 68.71 | No, ratchet |
| `packages/ui` | 97.20 | 80.48 | 92.06 | 97.20 | Yes |
| `apps/mfe-auth` | 92.23 | 75.40 | 93.10 | 92.23 | Yes |
| `e2e` | 82.05 | 77.77 | 81.25 | 80.95 | Yes |

![shell before](evidence/01-before-shell.png)
![ui before](evidence/02-before-ui.png)
![mfe-auth before](evidence/03-before-mfe-auth.png)
![e2e before](evidence/04-before-e2e.png)

Only `apps/shell` is below target, so it is the only project that gets a ratcheted threshold (lines 70, branches 60, functions 62, statements 68).

**Problems and fixes.** The `e2e` number covers only the two helper files listed in its `include`, not the whole package; we kept that scope. The shell run leaves a `.vitest/` report folder that is not committed.

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
