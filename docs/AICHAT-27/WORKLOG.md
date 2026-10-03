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

### US2 · Semgrep configuration with rule packs and custom rules ([AICHAT-50](https://ipca-grupo11.atlassian.net/browse/AICHAT-50))

**What and why.** We wanted one configuration that runs the same way on a laptop and in CI. `scripts/ci/semgrep.sh` runs the pinned Docker image with our own rules (`.semgrep.yml`) and nine registry packs (TypeScript, React, Express, njsscan, JWT, secrets, GitHub Actions, Dockerfile, OWASP Top 10). `.semgrepignore` leaves out generated code. The two custom rules look for secrets that get a literal fallback: a zod `.default("...")` on a name like `*_SECRET`, and `process.env.X ?? "..."` / `|| "..."`. Both are ERROR.

**Files.**
- `.semgrep.yml` (new): the two custom rules.
- `.semgrepignore` (new): `node_modules`, `dist`, `build`, `coverage`, `.nx`, `.vite`, Prisma client (`services/*/src/generated/`), `@mf-types`, lock file, `docs/`.
- `scripts/ci/semgrep.sh` (new): runs Semgrep and writes `semgrep-results/semgrep.sarif`.
- `.gitignore`: ignores `semgrep-results/`.
- `docs/AICHAT-27/SAST.md`: local run documented.

**How to run.**

```sh
scripts/ci/semgrep.sh
```

**How to repeat it manually.**

1. Start Docker and run the command from the repo root.
2. Wait about 15 seconds (the first run pulls the image and the packs).
3. Expected output: `semgrep exit code: 0` and the file `semgrep-results/semgrep.sarif`. Then `node scripts/ci/sast-summary.mjs semgrep-results/semgrep.sarif` prints the table (the script is added in US5).

**Result.** The first run is our baseline: 24 ERROR, 34 WARNING and 13 INFO findings. Both custom rules fire: `aichat.secret-with-literal-default-zod` finds the JWT default in `services/conversation-service/src/shared/env.ts:7`, and `aichat.secret-env-fallback-literal` finds a fallback in an e2e fixture.

![Baseline scan](evidence/01-baseline-scan.png)

**Problems and fixes.**
- Registry rules cannot be listed inside `.semgrep.yml`, so the packs live in the shell script.
- The CLI does not print its findings as a table, so we read the SARIF with a small script (US5).
- Semgrep prints some parse warnings for shell snippets in workflow files. They are not errors and do not change the exit code.

### US3 · Triage existing SAST findings ([AICHAT-68](https://ipca-grupo11.atlassian.net/browse/AICHAT-68))

**What and why.** The baseline had 24 ERROR findings, which would block every PR. We went through each one. Nothing needed a code fix: 16 are fake secrets in tests, 4 are an HTTP header name, 1 is a dummy bcrypt hash, 2 are observability Dockerfiles and 1 is the real JWT default secret. The JWT default (F1, High) is not fixed in this epic by owner decision: it is waived, and the bug is ticketed as [AICHAT-210](https://ipca-grupo11.atlassian.net/browse/AICHAT-210). The 34 WARNING and 13 INFO items stay reported and are accepted with a reason.

**Files.**
- `docs/AICHAT-27/WAIVERS.md` (new): every waiver with ID, location, count and reason.
- `.semgrepignore`: test files, `e2e/src/fixtures/` and test setup folders.
- `nosemgrep` comments (reason on the line above) in `apps/mfe-chat/src/shared/types.ts`, `packages/shared-types/src/api-keys/schema.ts`, `packages/shared-types/src/chat/provider.ts`, `services/conversation-service/src/shared/contracts/http.ts`, `services/auth-service/src/features/session/model.ts`, `services/conversation-service/src/shared/env.ts`, `observability/alloy.Dockerfile`, `observability/loki.Dockerfile`. Comments only, no behaviour change.
- `docs/AICHAT-27/evidence/02-clean-scan.*`

**How to run.**

```sh
scripts/ci/semgrep.sh && node scripts/ci/sast-summary.mjs semgrep-results/semgrep.sarif
```

**How to repeat it manually.**

1. Run the command from the repo root with Docker running.
2. Compare the table with `WAIVERS.md`.
3. Expected output: `No ERROR findings`, 23 WARNING and 13 INFO, exit code 0.

**Result.** 0 ERROR after triage. F1 is waived as High (W5) pointing to AICHAT-210.

![Scan after triage](evidence/02-clean-scan.png)

**Problems and fixes.**
- `nosemgrep` only matched the short rule id (the last part), not the full dotted id, so we use the short one.
- A `nosemgrep` comment must sit on the line directly above the finding, so the reason goes on its own line above it.
- SARIF keeps suppressed findings and marks them as suppressed, so our summary script skips those entries.

### US4 · …

### US5 · …

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
