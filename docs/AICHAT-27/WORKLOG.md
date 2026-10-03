---
title: "AICHAT-27 · SAST: work log"
---

# AICHAT-27 · SAST: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-27](https://ipca-grupo11.atlassian.net/browse/AICHAT-27) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-27-sast` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which code is scanned? | All TS/JS, Dockerfiles and GitHub Actions workflows; generated code (`dist`, coverage, Prisma client) excluded | Owner |
| Tooling agreed | Met | Semgrep CE or CodeQL? (plan decision D4) | Semgrep CE in GitHub Actions; CodeQL needs GitHub Advanced Security on a private repo. Results as a job summary and a SARIF artifact | Owner |
| Target environment available | Met | Where does it run? | Locally (Semgrep in Docker) and in GitHub Actions | Owner |
| Blocking level | Met | Which findings block the merge? | ERROR only; WARNINGs are listed in the summary and reviewed | Owner |
| JWT default secret (F1) | Met | Fix now or ticket? | Ticket as a High bug, waive in `WAIVERS.md`, fix later | Owner |
| Required check | Met | Change branch protection on `main`? | Required on `integration/testing-epics` now; the owner adds it to `main` after the final PR | Owner |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS (local) / Ubuntu (CI) | macOS 26.3 / `ubuntu-latest` | — |
| Node | `node -v` → v24.9.0 | `.nvmrc` |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → 29.4.0 | OrbStack or Docker Desktop |
| Semgrep CE | `semgrep --version` → 1.140.0 (image `semgrep/semgrep:1.140.0`) | `docker pull semgrep/semgrep:1.140.0` |

## 3. Steps

### US1 · Choose the SAST tool and record the decision ([AICHAT-35](https://ipca-grupo11.atlassian.net/browse/AICHAT-35))

**What and why.** We compared Semgrep CE and CodeQL for a private repository. CodeQL needs GitHub Code Security (Advanced Security) on private repos, which we do not have. Semgrep CE is free, runs in about 15 seconds without a build and supports custom YAML rules. Its SARIF cannot go to the Security tab (that also needs GHAS), so we keep it as an artifact and write a job summary. The owner approved Semgrep CE on 2026-10-03.

**Files.**
- `docs/AICHAT-27/SAST.md` (new): the decision table, severity policy, scope, local run, waiver rules and the required-check note.
- `docs/AICHAT-27/evidence/00-environment.*`: tool versions.

**How to run.**

```sh
docker run --rm semgrep/semgrep:1.140.0 semgrep --version
```

**How to repeat it manually.**

1. Start Docker.
2. Run the command above.
3. Expected output: `1.140.0`.

**Result.** Decision recorded in `docs/AICHAT-27/SAST.md`; the image tag is pinned to `1.140.0`.

![Tool versions](evidence/00-environment.png)

**Problems and fixes.** Docker was not running at first; we started OrbStack and pulled the pinned image.

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
