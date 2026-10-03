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

### US2 · Shared coverage preset in every project ([AICHAT-81](https://ipca-grupo11.atlassian.net/browse/AICHAT-81))

**What and why.** Only `@platform/test-config` itself used the shared preset; the other 13 projects copied `80` by hand, so changing the policy meant editing 13 files. We extended the preset and moved every Node test project to it, keeping only project-specific `include`/`exclude` locally.

**Files.**
- `packages/test-config/coverage-thresholds.ts`, `vitest.preset.ts`, `index.ts`, specs and README: `thresholds` override option, `appCoverageThresholds` (branches 75), `e2eCoverageThresholds` (branches 70), reporters `text` + `lcov` + `json-summary`.
- `packages/test-config/package.json`: `main`/`exports` now point to the built `dist/`, because Node loads Vite configs natively and cannot resolve `.js` imports to `.ts` sources.
- `vite.config.ts` / `vitest.config.ts` of `apps/shell`, `apps/mfe-auth`, `apps/mfe-chat`, `apps/mfe-settings`, `packages/ui`, `packages/shared-types`, `packages/observability`, `packages/pact-config`, `packages/eslint-config`, `packages/workspace-config`, `services/auth-service`, `services/conversation-service`, `e2e`.
- Each of those `package.json` files (devDependency `@platform/test-config: workspace:*`) and `pnpm-lock.yaml`.
- `packages/eslint-config/project.json` (`build` no longer depends on `^build`), `packages/test-config/eslint.config.js`.

**How to run.**
```sh
pnpm nx run-many -t test --skip-nx-cache
```

**How to repeat it manually.**
1. Clean checkout of the branch, `pnpm install`.
2. `grep -l '@platform/test-config' apps/*/vite.config.ts packages/*/vit*.config.ts services/*/vitest.config.ts e2e/vitest.config.ts | wc -l`. Expected: `13` (the 14th project, `test-config`, defines the preset and imports it relatively).
3. `grep -lE "provider: .v8.|thresholds: \{" ...` on the same files. Expected: no output.
4. `pnpm nx run-many -t test --skip-nx-cache`. Expected: all 15 projects pass.

**Result.** 13 configs import the preset, none keeps a hand-written `provider`/`thresholds` block, and all 15 test targets pass. `testing/k6` has no coverage by design.

![imports](evidence/05-shared-preset-imports.png)
![nx test](evidence/06-nx-test-after-preset.png)

**Problems and fixes.**
- Vite loads the config natively and the package exported `index.ts` with `.js` import suffixes, so it failed with `ERR_MODULE_NOT_FOUND`. We export the compiled `dist/` instead; the `test` target already builds dependencies first (`dependsOn: ^build`).
- `eslint-config` and `test-config` now depend on each other, which made Nx report a circular task graph. We set the no-op `eslint-config:build` to `dependsOn: []` and switched off the circular-dependency lint rule for `test-config/eslint.config.js` only.
- Lowered branch threshold for `apps/mfe-chat` and `apps/mfe-settings` from 80 to 75 follows the agreed app group. Their measured values still pass.

### US3 · Enforce coverage in shell, ui, mfe-auth and e2e ([AICHAT-100](https://ipca-grupo11.atlassian.net/browse/AICHAT-100))

**What and why.** Four projects did not enforce coverage in CI: `apps/shell` and `packages/ui` ran `vitest run` without `--coverage`, and `apps/mfe-auth` and `e2e` had no thresholds (the preset from US2 now gives them one). We turned `--coverage` on in the first two. `apps/shell` is below its target, so we applied the ratchet policy instead of lowering the bar.

**Files.**
- `apps/shell/package.json`, `apps/shell/project.json`, `packages/ui/package.json`, `packages/ui/project.json` (`vitest run --coverage`).
- `apps/shell/vite.config.ts` (ratcheted thresholds with dated TODOs).
- Thresholds for `apps/mfe-auth` (80/75/80/80) and `e2e` (80/70/80/80) come from the preset set up in US2.

**How to run.**
```sh
pnpm nx run shell:test --skip-nx-cache   # also ui, mfe-auth, e2e
```

**How to repeat it manually.**
1. Clean checkout of the branch, `pnpm install`.
2. `pnpm nx run shell:test --skip-nx-cache`. Expected: 24 tests pass, a coverage table with "All files | 68.71 | 60.97 | 62.12 | 70.51", exit 0.
3. Repeat for `ui`, `mfe-auth`, `e2e`. Expected: exit 0 and the numbers below.
4. Check that `coverage/coverage-summary.json` exists in each of the four projects.

**Result.**

| Project | Statements | Branches | Functions | Lines | Thresholds (S/B/F/L) |
|---|---|---|---|---|---|
| `apps/shell` | 68.71 | 60.97 | 62.12 | 70.51 | 68/60/62/70 (ratchet, target 80/75/80/80) |
| `packages/ui` | 97.20 | 80.48 | 92.06 | 97.20 | 80/80/80/80 |
| `apps/mfe-auth` | 92.23 | 75.40 | 93.10 | 92.23 | 80/75/80/80 |
| `e2e` | 80.95 | 77.77 | 81.25 | 82.05 | 80/70/80/80 |

![shell](evidence/07-after-shell.png)
![ui](evidence/08-after-ui.png)
![mfe-auth](evidence/09-after-mfe-auth.png)
![e2e](evidence/10-after-e2e.png)
![json-summary](evidence/11-json-summary.png)

`pnpm test` (all projects) is run at the end of the epic, see section 5.

**Problems and fixes.** Nothing failed. The numbers are identical to the US1 measurement, so moving to the preset did not change what is counted. The `html` reporter used by these projects was replaced by the shared `text` + `lcov` + `json-summary` set.

### US4 · Guard test for test targets that skip coverage ([AICHAT-118](https://ipca-grupo11.atlassian.net/browse/AICHAT-118))

**What and why.** Coverage thresholds only protect us if every project's `test` target actually runs with `--coverage`. We added a test that fails when a project forgets it, so a future project cannot skip the thresholds silently.

**Files.**
- `packages/workspace-config/src/coverage-guard.js` (project discovery, `checkProject`, exempt lists with reasons)
- `packages/workspace-config/src/coverage-guard.test.js`
- `apps/mfe-auth/package.json` (fix found by the guard)
- `packages/test-config/README.md` (documents the exempt list)

**How to run.**
```sh
pnpm nx run workspace-config:test --skip-nx-cache
# or only the guard
cd packages/workspace-config && pnpm exec vitest run src/coverage-guard.test.js
```

**How to repeat it manually.**
1. Clean checkout of the branch, `pnpm install`.
2. Run the guard command above. Expected: 25 tests pass.
3. In `packages/ui/project.json` change the test command to `vitest run` (no `--coverage`) and run the guard again. Expected: 1 failure with `packages/ui: the Nx test target "vitest run" does not run with --coverage`.
4. Revert the change (`git checkout packages/ui/project.json`) and run again. Expected: all green.

**Result.** For each project with a `test` target the guard checks three things: the Nx command has `--coverage`, the `package.json` test script has `--coverage`, and the Vitest config imports `@platform/test-config`. The exempt list is `testing/k6` (k6 runtime, not Node, nothing to instrument) and, for the import check only, `packages/test-config` (it defines the preset). On its first run the guard failed on a real gap: the `apps/mfe-auth` `package.json` script still ran `vitest run` without `--coverage` (the Nx target was already fixed in US3).

![guard finds mfe-auth](evidence/14-guard-finds-mfe-auth.png)
![guard passes](evidence/15-guard-passes.png)
![guard fails on a broken case](evidence/16-guard-fails-on-broken-case.png)

**Problems and fixes.** The first run failed for `apps/mfe-auth` as described; we fixed the script and the guard passed. The deliberately broken case (`packages/ui` without `--coverage`) failed as expected and was reverted. The guard reads the files directly instead of calling the Nx CLI, so it stays fast and does not depend on the Nx daemon.

### US5 · Coverage report on each PR and proof that a drop fails CI ([AICHAT-132](https://ipca-grupo11.atlassian.net/browse/AICHAT-132))

**What and why.** Thresholds already fail the `test` target, but a reviewer only sees a red job. We added a small Node script that reads every project's `coverage/coverage-summary.json` (the `json-summary` reporter) and writes one Markdown table to the GitHub job summary: project, lines, branches, functions, statements. The CI step uses `if: always()`, so the table still appears when a threshold fails the test step. The script has no dependencies. Thresholds stay in each project's own Vitest config: 80 for services and packages, 80 (75 branches) for MFEs and shell, 80 (70 branches) for e2e.

**Files.**
- `scripts/ci/coverage-summary.mjs`: finds `**/coverage/coverage-summary.json` (skips `node_modules`, `.git`, `.nx`, `dist`) and writes the table to `$GITHUB_STEP_SUMMARY`, or to stdout when it is unset.
- `scripts/ci/coverage-summary.test.mjs`: `node --test` unit test for the table formatting.
- `.github/workflows/ci.yml`: new `Coverage summary` step after `nx affected`.
- `docs/AICHAT-34/evidence/20-coverage-summary-local.{log,png}`

**How to run.**
```bash
pnpm exec nx affected -t test        # writes coverage/coverage-summary.json per project
node scripts/ci/coverage-summary.mjs # table on stdout
node --test scripts/ci/coverage-summary.test.mjs
```

**How to repeat it manually.** Create two fixtures such as `/tmp/fx/packages/ui/coverage/coverage-summary.json` and `/tmp/fx/services/auth/coverage/coverage-summary.json`, each with `{"total":{"lines":{"pct":92.5},"branches":{"pct":81.25},"functions":{"pct":100},"statements":{"pct":93.1}}}`, then run `node scripts/ci/coverage-summary.mjs /tmp/fx`. Set `GITHUB_STEP_SUMMARY=/tmp/out.md` to check the file output.

**Result.** The table lists one row per project with two decimals; missing metrics show `n/a` and an empty run prints a "no coverage-summary.json found" row. Both unit tests pass.

![](evidence/20-coverage-summary-local.png)

**Problems and fixes.** `node --test scripts/ci/` (directory argument) fails on this Node version, so the test is run by file path. The script only runs its `main` when executed directly, so the test can import the formatter without side effects. Projects that do not yet emit the summary file are simply absent from the table until the reporter lands.

**Failing-PR proof.** To show that a coverage drop fails CI:
1. Branch off `integration/testing-epics`: `git switch -c test/coverage-drop-proof`.
2. Lower coverage in one project: either delete a test file in a project with thresholds, or raise a threshold above the current value (for example `lines: 100`) in its Vitest config.
3. Commit, push, and open a **draft** PR into `integration/testing-epics`.
4. Wait for CI. The `nx affected` step must fail on the coverage threshold, and the `Coverage summary` step must still show the table in the job summary.
5. Link the failed run here, then close the PR without merging and delete the branch.

PR: #<to fill>

### US6 · Narrow coverage excludes ([AICHAT-139](https://ipca-grupo11.atlassian.net/browse/AICHAT-139))

**What and why.** `apps/mfe-chat` excluded the whole `src/app/**` folder, which holds routes, pages, `ChatWorkspace`, `auth-context`, `use-media-query` and the `split-panes` logic. A broad exclude hides untested logic (`split-panes.ts` has a test that did not count). We narrowed it to the one real bootstrap file, `src/app/remote-entry.tsx` (Module Federation mount, no logic of its own).

**Files.**
- `apps/mfe-chat/vite.config.ts`

**How to run.**
```sh
pnpm nx run mfe-chat:test --skip-nx-cache
```

**How to repeat it manually.**
1. Clean checkout of the branch, `pnpm install`.
2. In `apps/mfe-chat/vite.config.ts` the exclude list is `["src/test/**", "**/index.ts", "src/app/remote-entry.tsx"]`.
3. Run the command above. Expected: 122 tests pass, exit 0, and `app` appears as a row in the coverage table.

**Result.**

| Metric | Before (`src/app/**` excluded) | After (only `remote-entry.tsx` excluded) | Threshold |
|---|---|---|---|
| Statements | 93.45 | 89.87 | 80 |
| Branches | 87.11 | 85.21 | 75 |
| Functions | 91.02 | 89.71 | 80 |
| Lines | 95.20 | 91.86 | 80 |

The `src/app` folder alone is at 82.92 % lines, 80.11 % branches and 84.84 % functions, so no threshold had to be lowered.

![before](evidence/12-before-mfe-chat.png)
![after](evidence/13-after-mfe-chat.png)

**Problems and fixes.** None; the project stays above its thresholds. The `**/index.ts` exclude is still in place (barrel files); we left it because the story only covers `src/app/**`.

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

Coverage in % (statements / branches / functions / lines). Before = measured on 2026-10-03 before any change; After = measured with the final configuration.

| Project | Before | After | Enforced before | Enforced after (S/B/F/L) |
|---|---|---|---|---|
| `apps/shell` | 68.71 / 60.97 / 62.12 / 70.51 | 68.71 / 60.97 / 62.12 / 70.51 | No | Yes, ratchet 68/60/62/70 |
| `packages/ui` | 97.20 / 80.48 / 92.06 / 97.20 | 97.20 / 80.48 / 92.06 / 97.20 | No | Yes, 80/80/80/80 |
| `apps/mfe-auth` | 92.23 / 75.40 / 93.10 / 92.23 | 92.23 / 75.40 / 93.10 / 92.23 | No | Yes, 80/75/80/80 |
| `e2e` | 80.95 / 77.77 / 81.25 / 82.05 | 80.95 / 77.77 / 81.25 / 82.05 | No | Yes, 80/70/80/80 |
| `apps/mfe-chat` | 93.45 / 87.11 / 91.02 / 95.20 | 89.87 / 85.21 / 89.71 / 91.86 | Yes, `src/app/**` excluded | Yes, 80/75/80/80, only `remote-entry.tsx` excluded |

Other results: 13 of 13 Node test configs use `@platform/test-config`; a guard test fails any project whose test target skips `--coverage`; `pnpm test` passes for all 15 projects.

![pnpm test](evidence/17-pnpm-test-all.png)

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
