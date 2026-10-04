---
title: "AICHAT-16 · [Foundations] Mutation testing"
---

# AICHAT-16 · [Foundations] Mutation testing

| Field | Value |
|---|---|
| Jira | [AICHAT-16](https://ipca-grupo11.atlassian.net/browse/AICHAT-16) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Depends on | AICHAT-34 (coverage thresholds, JP) |
| Related | AICHAT-17 (unit testing, JP) |
| Layer | Test quality: services and shared packages |

## 1. Goal

**Stryker** runs on the chosen projects with an agreed **mutation score threshold**, surviving mutants in the core logic are
killed or justified, and the run is a **scheduled job**, not a merge gate.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** StrykerJS + Vitest runner; incremental mode
- [ ] Target environment available (local; GitHub runner for the schedule)
- [ ] **Coverage thresholds epic in place** → AICHAT-34 (JP), check status before US2
- [ ] **Target projects chosen** → candidates in §4.2, agreed in US1

**DoD**
- [ ] Runs as a scheduled job and passes on `main`
- [ ] Run instructions added to the project README or `docs/`
- [ ] Stryker runs on the chosen projects
- [ ] Mutation score threshold set
- [ ] Scheduled job, not a merge gate

## 3. Technologies

| Tool | Version | Role |
|---|---|---|
| `@stryker-mutator/core` | latest 9.x | Mutation engine, HTML/JSON reporters, `thresholds { high, low, break }`, incremental mode |
| `@stryker-mutator/vitest-runner` | latest 9.x | Runs the existing Vitest suites |
| Vitest | `5.0.1` | Test runner (check runner compatibility with Vitest 5 before US2) |
| `@platform/test-config` | in repo | Shared coverage thresholds; candidate home for a shared Stryker base config |
| Nx | `23.2.1` | `mutate` target per project |

## 4. Discovery: current state

### 4.1 Tooling

No Stryker dependency or config anywhere in the repo. Coverage thresholds exist in `packages/test-config/coverage-thresholds.ts`
but (per AICHAT-34) are not enforced in every project.

### 4.2 Candidate targets (logic-heavy, already well unit-tested)

| Project | Folders | Existing specs |
|---|---|---|
| conversation-service | `features/queue`, `features/messages` (service, processor), `features/llm-adapters`, `features/chats/service.ts` | `chat-queue.spec.ts`, `queue-manager.spec.ts`, `processor.spec.ts`, `service.spec.ts`, adapter specs, `http-stream.spec.ts` |
| auth-service | `features/session` (model, verify, cookies), `shared/jwt.ts`, `features/register/model.ts` | per-file specs |
| packages/shared-types | `auth` (password policy, jwt), `chat`, `api-keys` schemas | `*.test.ts` per file |

Out of scope: React MFEs (slow in jsdom, covered by AICHAT-17/18), generated Prisma client, `test-utils`, type-only modules.

## 5. Implementation plan (steps)

1. US1: confirm targets and thresholds (e.g. `high 80 / low 60 / break 50`, tuned after the baseline).
2. conversation-service: `stryker.config.mjs` with Vitest runner, `mutate` globs, `incremental: true`
   (`reports/stryker-incremental.json`), HTML + JSON reporters; Nx `mutate` target; record baseline per folder.
3. Base config in `packages/test-config` reused by auth-service and shared-types; measure run time per project.
4. Triage survivors: add/strengthen assertions; mark equivalent mutants with `// Stryker disable next-line <mutator>: <reason>`.
5. `.github/workflows/mutation.yml` weekly + dispatch; upload HTML reports; fail only below `break`.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-205](https://ipca-grupo11.atlassian.net/browse/AICHAT-205) | AICHAT-16-US1 | As a team, I want mutation scope and thresholds agreed | Targets chosen; high/low/break per target; AICHAT-34 dependency confirmed | 1 |
| [AICHAT-206](https://ipca-grupo11.atlassian.net/browse/AICHAT-206) | AICHAT-16-US2 | As a developer, I want Stryker on conversation-service | Core + Vitest runner; globs exclude test-utils/Prisma/types; `mutate` target, incremental; baseline per folder | 3 |
| [AICHAT-207](https://ipca-grupo11.atlassian.net/browse/AICHAT-207) | AICHAT-16-US3 | As a developer, I want the same setup on auth-service and shared-types | Shared base config; `mutate` targets; baselines; run time measured | 3 |
| [AICHAT-208](https://ipca-grupo11.atlassian.net/browse/AICHAT-208) | AICHAT-16-US4 | As a developer, I want surviving mutants killed or justified | Survivors triaged; stronger assertions; equivalents disabled with reason; thresholds reached; before/after scores | 5 |
| [AICHAT-209](https://ipca-grupo11.atlassian.net/browse/AICHAT-209) | AICHAT-16-US5 | As a team, I want mutation testing scheduled with published reports | `mutation.yml` weekly + dispatch, not a gate; HTML artifacts; fails only below break; run instructions | 2 |
| | | **Total** | | **14** |

## 7. Risks and open decisions

- Stryker's Vitest runner must support Vitest 5; if not, pin a compatible version or use the command runner (slower).
- Run time grows with test count; incremental mode and narrow globs keep it within a scheduled job.
- Thresholds set before the baseline are guesses; finalise them after US2/US3.

## 8. Notes for the report

Line coverage shows which code ran, not whether the tests would notice a bug. Mutation testing measures that directly by
injecting small faults and checking the tests fail. The epic targets the backend logic and shared schemas, where the queue,
streaming and authentication rules live, and runs on a schedule so it adds evidence without slowing down PRs.
