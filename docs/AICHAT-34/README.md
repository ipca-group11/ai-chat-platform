---
title: "AICHAT-34 · [Foundations] Coverage thresholds"
---

# AICHAT-34 · [Foundations] Coverage thresholds

| Field | Value |
|---|---|
| Jira | [AICHAT-34](https://ipca-grupo11.atlassian.net/browse/AICHAT-34) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO (TEST-TYPES marks it 🟡: thresholds exist in most projects but are not all enforced) |
| Blocks | AICHAT-17 (unit), AICHAT-16 (mutation testing, João Vieira) |
| Layer | Test quality |

## 1. Goal

Every project has **Vitest coverage thresholds** (line and branch minimum agreed per project), and **going below the
threshold fails CI**.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** The 15 test projects in §4 confirmed in scope (k6 exempt)
- [ ] **Tooling agreed:** Vitest coverage-v8 through the `@platform/test-config` preset confirmed
- [ ] Target environment available
- [ ] Line/branch minimum agreed per project → **proposal §5** (STACK.md decision #6 already sets 80%)

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Vitest coverage thresholds set in every project
- [ ] Going below the threshold fails CI

## 3. Technologies

| Tool | Role |
|---|---|
| Vitest `5.0.1` + `@vitest/coverage-v8` | Coverage (V8), `coverage.thresholds` makes `vitest run --coverage` exit non-zero when coverage is below the threshold |
| `@platform/test-config` (`packages/test-config`) | Shared `coverageThresholds` (80/80/80/80) and `coveragePreset()`: **the single source of truth** per STACK.md |
| Nx `23.2.1` | `nx affected -t test` in `.github/workflows/ci.yml` |
| `lcov` reporter + (optional) a coverage summary step / Codecov | Visibility of coverage per PR |
| `packages/workspace-config` tests | Already test repo config; a natural place for a "every project enforces thresholds" guard test |

## 4. Discovery: current state per project

| Project | Thresholds in config | `--coverage` in test target | **Enforced in CI?** | Uses shared preset? |
|---|---|---|---|---|
| `apps/shell` | 80 ×4 (no provider set → default v8) | ❌ `vitest run` | **No** | No |
| `apps/mfe-auth` | **none** | ✅ | **No** (nothing to enforce) | No |
| `apps/mfe-chat` | 80 ×4 (excludes `src/app/**`, `index.ts`) | ✅ | Yes | No |
| `apps/mfe-settings` | 80 ×4 (excludes `main`, `routes`, `app`) | ✅ | Yes | No |
| `packages/ui` | 80 ×4 | ❌ `vitest run` | **No** | No |
| `packages/shared-types` | 80 ×4 | ✅ | Yes | No |
| `packages/observability` | 80 ×4 | ✅ | Yes | No |
| `packages/pact-config` | 80 ×4 | ✅ | Yes | No |
| `packages/eslint-config` | 80 ×4 (rules only) | ✅ | Yes | No |
| `packages/workspace-config` | 80 ×4 | ✅ | Yes | No |
| `packages/test-config` | via `coveragePreset` | ✅ | Yes | **Yes (only one)** |
| `services/auth-service` | 80 ×4 | ✅ | Yes | No |
| `services/conversation-service` | 80 ×4 | ✅ | Yes | No |
| `e2e` (fixture helpers) | **none** (include limited to 2 files) | ✅ | **No** | No |
| `testing/k6` | none (no Node source) | ❌ | n/a (document as exempt) | — |

**Summary:** 15 test projects; **4 don't enforce** (shell, ui, mfe-auth, e2e) and k6 is exempt by nature.
**Only 1 of 15 uses the shared preset**; the other 13 copy `80` by hand, so changing the policy means editing 13 files.

Other observations:
- `apps/mfe-chat` excludes the whole `src/app/**` folder (routes, pages, workspace, `auth-context`, `split-panes` logic) and every `index.ts`. Broad excludes can hide untested logic (`split-panes.ts` *does* have a test, but it doesn't count).
- `apps/mfe-auth` / `apps/shell` / `packages/ui` use the `html` reporter, not `lcov`, so no machine-readable report for CI.
- Baseline: `nx run-many -t test` passes on all 15 projects (2026-10-03). **Coverage numbers for shell, ui, mfe-auth are unknown** because they are not computed in CI. Measure them before switching enforcement on, or CI breaks.
- `nx affected` only tests changed projects, so a project's threshold is only checked when that project changes. That is fine for a gate; a weekly full run (`nx run-many -t test`) catches drift from shared-package changes.

## 5. Thresholds (proposal, DoR)

STACK.md decision #6 sets **80% lines/statements/functions/branches** for `services/*` and `packages/ui`, and says frontends are "encouraged". Proposal:

| Group | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| `services/*` | 80 | 80 | 80 | 80 |
| `packages/*` (libraries) | 80 | 80 | 80 | 80 |
| `apps/mfe-*`, `apps/shell` | 80 | 75 | 80 | 80 |
| `e2e` helpers | 80 | 70 | 80 | 80 |
| `testing/k6` | exempt (k6 runtime, not Node) | | | |

If a project is below the threshold today: set its threshold at the **current value (rounded down)** with a dated TODO, then raise it with AICHAT-17/18 work ("ratchet"), instead of lowering the global bar.

## 6. Implementation plan (steps)

1. **Measure:** run `vitest run --coverage` for shell, ui, mfe-auth and e2e locally; record the numbers in this doc.
2. Extend `@platform/test-config` with per-group presets (`servicePreset`, `libraryPreset`, `appPreset`) or an override parameter (`coveragePreset({ thresholds: { branches: 75 } })`).
3. Switch **every** `vitest.config.ts`/`vite.config.ts` to the shared preset (13 files); keep project-specific `include`/`exclude`.
4. Add `--coverage` to the `test` targets of `apps/shell` and `packages/ui`; add thresholds to `apps/mfe-auth` and `e2e`.
5. Review broad excludes (mfe-chat `src/app/**`), keeping only real bootstrap files out.
6. Standardise reporters on `text` + `lcov` (+ `json-summary` for CI summaries).
7. **Guard test** in `packages/workspace-config`: for each Nx project with a `test` target (except an explicit exempt list), assert the command includes `--coverage` and the config imports `@platform/test-config`. Stops future projects from skipping thresholds.
8. **CI proof:** temporarily lower a project's coverage in a test PR and check the `nx affected` job fails, then revert. Optionally add a coverage summary to `$GITHUB_STEP_SUMMARY`, and a weekly `nx run-many -t test` scheduled run.
9. Document: thresholds table, how to run coverage locally, ratchet policy.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-63](https://ipca-grupo11.atlassian.net/browse/AICHAT-63) | AICHAT-34-US1 | As a team, I want agreed thresholds per project group and a ratchet policy | §5 approved; current values of shell/ui/mfe-auth/e2e measured and recorded | 1 |
| [AICHAT-81](https://ipca-grupo11.atlassian.net/browse/AICHAT-81) | AICHAT-34-US2 | As a maintainer, I want every project to use the shared preset so that the policy changes in one place | All 14 Node test projects import `@platform/test-config`; duplicates removed | 3 |
| [AICHAT-100](https://ipca-grupo11.atlassian.net/browse/AICHAT-100) | AICHAT-34-US3 | As a team, I want coverage enforced in shell, ui, mfe-auth and e2e so that no project silently skips the gate | `--coverage` + thresholds in all four; CI green | 2 |
| [AICHAT-118](https://ipca-grupo11.atlassian.net/browse/AICHAT-118) | AICHAT-34-US4 | As a maintainer, I want a guard test that fails when a project's test target skips coverage | Test in `packages/workspace-config`; exempt list documented (k6) | 2 |
| [AICHAT-132](https://ipca-grupo11.atlassian.net/browse/AICHAT-132) | AICHAT-34-US5 | As a reviewer, I want to see the coverage result in each PR, and proof that a drop fails CI | Job summary with coverage per affected project; failing-PR proof linked here | 2 |
| [AICHAT-139](https://ipca-grupo11.atlassian.net/browse/AICHAT-139) | AICHAT-34-US6 | As a developer, I want narrow coverage excludes so that real logic isn't hidden | mfe-chat `src/app/**` exclude narrowed; numbers recorded | 1 |

## 8. Risks and open decisions

- Turning enforcement on in shell/ui/mfe-auth may **break CI immediately** if they are below 80%, hence measure first and use the ratchet.
- Coverage is necessary but not sufficient; mutation testing (AICHAT-16, João Vieira) builds on this.

## 9. Notes for the report

Coverage thresholds look complete at first sight (80% in most configs, per STACK.md), but discovery found **4 of 15
projects where they are not enforced**: shell and ui run tests without `--coverage`, and mfe-auth and e2e have no thresholds.
**Only 1 project uses the shared preset**; the rest copy the numbers by hand. The plan measures first, moves every project to
the shared preset, enforces thresholds everywhere with a ratchet for low projects, and adds a guard test so new projects can't skip the gate.
