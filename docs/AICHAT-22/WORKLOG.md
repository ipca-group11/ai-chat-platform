---
title: "AICHAT-22 · Bundle size budget testing: work log"
---

# AICHAT-22 · Bundle size budget testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-22](https://ipca-grupo11.atlassian.net/browse/AICHAT-22) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-22-bundle-size-budget-testing` |
| Started / finished | 2026-10-03 / 2026-10-03 |
| Pull requests | not opened yet (branch not pushed) |
| Status | Done on the branch, waiting for the pull request into `integration/testing-epics` |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which files? | Shell and the 3 remotes (mfe-auth, mfe-chat, mfe-settings): each `remoteEntry.js`, the exposed-module chunk graph and a total guard rail that includes the shared fallbacks | Team (owner delegated) |
| Tooling agreed | Met | Which tool? | size-limit with `@size-limit/file` (gzip) as an Nx `size` target per app, config in TypeScript where size-limit allows it; globs for hashed chunk names | Team (owner delegated) |
| Target environment available | Met | Where does it run? | The production build output (`nx build`) locally and in the CI `nx affected` job; no stack needed | Team (owner delegated) |
| Size limits agreed per remote | Met | README §5 proposal | Measured baseline + 10% for every group (rounded up to the next kB), with the README numbers as upper bounds: `remoteEntry.js` ≤ 8 KB gzip, shell own chunks ≤ 120 KB, auth and settings routes ≤ 40 KB, chat routes ≤ 80 KB. Limits are tightened after improvements, never loosened without a PR note | Team (owner delegated) |
| Runtime-loaded vs all emitted | Met | Fallback chunks inflate totals | Both: strict limits on what loads at runtime, a looser total over all emitted JS | Team (owner delegated) |
| Shared-once check (AICHAT-119) | Met | The browser e2e suite is disabled | One small local headless run that opens `/chats` against the mock stack and lists the JS requests (React, react-dom, router loaded once); the result is recorded in the work log, not run in CI | Team (owner delegated) |
| Where the budget lives | Met | Config as `.ts` or JSON? | `apps/<app>/.size-limit.ts` per app (size-limit 14 reads a TypeScript config); no `.js` file | Team (owner delegated) |
| "Target passes on `main`" | Met | `main` does not have the earlier epics yet, so its build differs from the branch | The check passes on the current base of the integration branch, which becomes `main`; limits were measured there | Team (owner delegated) |
| PR size report | Met | PR comment or job summary? | Job summary (no token, no comment spam), compared with a build of the base branch; the step never fails the job | Team (owner delegated) |
| Unit of size | Met | kB = 1000 or 1024 bytes? | 1 kB = 1000 bytes, as size-limit prints; limits use the same unit | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | 26.3 | n/a |
| Node | `node -v` → v24.21.0 | `nvm install` (reads `.nvmrc`) |
| pnpm | `pnpm -v` → 10.4.0 | `corepack enable` |
| Docker | `docker --version` → Docker version 29.4.0 | Docker Desktop or OrbStack (only for the US5 check) |
| size-limit | `pnpm exec size-limit --version` → 14.1.0 | `pnpm install` (root dev dependency, with `@size-limit/file`) |
| Chromium (Playwright 1.63.0) | headless, from the Playwright cache | `pnpm --filter e2e exec playwright install chromium` (US5 only) |

![Environment](evidence/00-environment.png)

## 3. Steps

### US1 · Agree bundle size limits per remote ([AICHAT-47](https://ipca-grupo11.atlassian.net/browse/AICHAT-47))

**What and why.** The analysis only had rough numbers, and they mixed two different things: files the browser downloads and fallback copies of React, the router and Query that every remote emits but never uses while the shell provides them. We built the four apps (`pnpm exec nx run-many -t build`) and measured the gzip size of every emitted `.js` file, then split them into groups by file name:

- `remoteEntry.js`: the federation manifest, the first file a host requests.
- application chunks: everything that is not federation glue and not a shared-library copy (the exposed routes of a remote, the pages of the shell).
- federation glue: the Module Federation runtime and loaders (`dist-*`, `utils-*`, `hostInit-*`, `mf-entry-bootstrap-*`, ...).
- shared-library copies: `*prebuild*` (fallbacks in a remote) and `*loadShare*` (the shell's own copies of react, react-dom, router, query and `@app/ui`).
- all emitted JS: a guard rail over everything.

The rule of the DoR review is: limit = measured baseline + 10%, rounded up to the next kB (1 kB = 1000 bytes, as size-limit counts), never above the upper bounds of the analysis (`remoteEntry.js` 8 KB, shell 120 KB, auth and settings routes 40 KB, chat routes 80 KB). Sizes are gzip, summed per group from the per-file gzip size, measured on 2026-10-03 on Node 24.21.0.

| App | Group | Baseline (kB) | Limit (kB) | Upper bound of the analysis |
|---|---|---|---|---|
| shell | `remoteEntry.js` | 6.15 | 7 | 8 |
| shell | application chunks | 51.54 | 57 | 120 |
| shell | federation glue | 117.60 | 130 | none |
| shell | shared-library copies | 121.36 | 134 | none |
| shell | all emitted JS | 296.64 | 327 | none |
| mfe-auth | `remoteEntry.js` | 6.22 | 7 | 8 |
| mfe-auth | route chunks | 24.75 | 28 | 40 |
| mfe-auth | federation glue | 116.94 | 129 | none |
| mfe-auth | shared-library copies | 123.70 | 137 | none |
| mfe-auth | all emitted JS | 271.61 | 299 | none |
| mfe-chat | `remoteEntry.js` | 6.26 | 7 | 8 |
| mfe-chat | route chunks | 63.07 | 70 | 80 |
| mfe-chat | federation glue | 123.08 | 136 | none |
| mfe-chat | shared-library copies | 123.75 | 137 | none |
| mfe-chat | all emitted JS | 316.15 | 348 | none |
| mfe-settings | `remoteEntry.js` | 6.22 | 7 | 8 |
| mfe-settings | route chunks | 25.84 | 29 | 40 |
| mfe-settings | federation glue | 116.55 | 129 | none |
| mfe-settings | shared-library copies | 89.64 | 99 | none |
| mfe-settings | all emitted JS | 238.25 | 263 | none |

Limits are tightened after improvements and never raised without a reason in the pull request.

**Files.**
- `docs/AICHAT-22/WORKLOG.md`: this table (the configuration that enforces it comes with US2).

**How to run.**

```sh
pnpm exec nx run-many -t build && for a in shell mfe-auth mfe-chat mfe-settings; do (cd apps/$a && pnpm exec size-limit --json); done
```

**How to repeat it manually.**

1. Build the apps: `pnpm exec nx run-many -t build`.
2. Run `gzip -9c apps/mfe-chat/dist/assets/routes-*.js | wc -c` for a single file, or the loop above for all groups (the group definitions are in `apps/<app>/.size-limit.ts`, added in US2).
3. Expected output: the sizes of the table (they move by a few bytes with the file hash and the gzip level).

**Result.** The remote entries are about 6 KB each. The application code is small (24 to 62 KB), while the federation glue (114 to 120 KB, mostly the 85 KB `dist-*` chunk that holds the federation runtime) and the shared-library copies weigh more than the application. That is why the budget separates the groups: a single "total" would hide a growth of the application behind the glue.

![Baseline measurement](evidence/01-baseline-measurement.png)

**Problems and fixes.** The analysis gave 241 KB gzip as the total JS of the shell; our figure for the same folder is 290 kB. The two numbers were taken with different tools and a different way of adding (the total here is the sum of the gzip size of each file, which is what a browser downloads). The measurement is repeatable, so the new figure is the baseline and the analysis figure is not used for any limit.

### US2 · Nx size target for remoteEntry.js and chunks ([AICHAT-65](https://ipca-grupo11.atlassian.net/browse/AICHAT-65))

**What and why.** We added `size-limit` with the `@size-limit/file` plugin as root dev dependencies (`pnpm add -D size-limit @size-limit/file -w`) and one configuration per app, `apps/<app>/.size-limit.ts` (size-limit 14 reads TypeScript configuration, so there is no `.js` file). Each file lists the five groups of US1 with their limits and `gzip: true`; the groups are globs over `dist/` (the application chunks are "all `assets/*.js` except the glue and the shared-library copies", so a new chunk lands in the budget without a config change). Every app has a `size` Nx target (`size-limit`, cwd the app) and `nx.json` gives the target its defaults: `dependsOn: ["build"]` (the check always measures a fresh build) and caching. The limits are the ones of US1.

**Files.**
- `apps/shell/.size-limit.ts`, `apps/mfe-auth/.size-limit.ts`, `apps/mfe-chat/.size-limit.ts`, `apps/mfe-settings/.size-limit.ts` (new): groups and limits.
- `apps/*/project.json`: `size` target.
- `nx.json`: `size` in `targetDefaults`.
- `package.json`, `pnpm-lock.yaml`: `size-limit`, `@size-limit/file`.

**How to run.**

```sh
pnpm exec nx run-many -t size        # builds what is missing, then checks the four apps
pnpm exec nx run mfe-chat:size       # one app
```

**How to repeat it manually.**

1. `pnpm install` (the lockfile has the two packages).
2. `pnpm exec nx run-many -t size`.
3. Expected output: for every group "Size limit: N kB" above "Size: M kB gzipped" with M smaller than N, and exit code 0.

**Result.** All 20 checks (5 groups, 4 apps) pass on the current base of the integration branch, which is the code that becomes `main`; `main` itself still lacks the earlier epics (unit-test, DAST and so on), so its build is not the one we measured.

![size target passes](evidence/02-size-target-passes.png)

**Problems and fixes.** size-limit counts 1 kB as 1000 bytes, not 1024, so the first limits (computed with 1024) were wrong by about 2.4% and were recomputed; the table of US1 has the final figures. The shell and the remotes name the shared-library copies differently (`*loadShare*` in the shell, `*prebuild*` and `*loadShare*` in remotes), so the group takes both patterns.

### US3 · Fail CI when a bundle exceeds its limit ([AICHAT-83](https://ipca-grupo11.atlassian.net/browse/AICHAT-83))

**What and why.** The `nx affected` step of `ci.yml` now runs `lint typecheck test build size`. `size` depends on `build` (set in `nx.json`), and size-limit exits with code 1 when a group is over its limit, so Nx marks the task failed and the job and the pull request go red. Only affected apps run the check: a change in `packages/ui` runs it for every app that uses it, a change in one remote runs it for that remote. `.factory/commands.json` (the `test` command that the CI spec compares with the workflow) has the same target list. The CI structural test `packages/workspace-config/src/ci.test.ts` checks the new target list, the `size` target and config of the four apps, and the dependency on `build`.

**Files.**
- `.github/workflows/ci.yml`: `size` in `NX_AFFECTED_TARGETS`, job name and comment.
- `.factory/commands.json`: `size` in the `test` command.
- `packages/workspace-config/src/ci.test.ts`: four new tests.

**How to run.**

```sh
pnpm exec nx affected -t lint typecheck test build size --base=origin/integration/testing-epics
pnpm --filter @platform/workspace-config exec vitest run src/ci.test.ts
```

**How to repeat it manually.**

1. Create `apps/mfe-chat/src/app/heavy-demo.ts` with an exported string of 50 KB of random characters.
2. Import it in `apps/mfe-chat/src/app/ChatListPage.tsx` and use it (`console.debug(heavy.length)`) so the bundler keeps it.
3. `pnpm exec nx run mfe-chat:size`.
4. Expected output: "Package size limit has exceeded" for `mfe-chat route chunks` and exit code 1. Delete the file and restore `ChatListPage.tsx`.

**Result.** The deliberate import of a 50 KB file (random text, which gzip cannot shrink) takes the chat route chunks from 63.07 kB to 102.28 kB against a limit of 70 kB, the `all emitted JS` group goes over as well, and `nx` exits with 1. Nothing of the test is committed: the script of the evidence adds the file and removes it at the end (`git status` is clean afterwards).

![Deliberate over-limit import fails](evidence/03-deliberate-over-limit-fails.png)

![CI spec](evidence/04-ci-spec.png)

**Problems and fixes.** A first idea was a separate CI job for the size check; it would build the apps a second time and `ci.test.ts` asserts that the workflow has one job, so the target stays in the same `nx affected` run, where the Nx cache already has the build. Branch protection is not available on this private repository (as noted in AICHAT-28), so the rule "no merge with a red `nx affected` job" remains a team rule.

### US4 · Show bundle size change on each PR ([AICHAT-101](https://ipca-grupo11.atlassian.net/browse/AICHAT-101))

**What and why.** A reviewer should see what a pull request does to the bundles without reading build logs. We chose the job summary of `ci.yml` (no token, no comment spam, nothing to maintain) over a PR comment. `scripts/ci/bundle-size.ts` has two commands: `snapshot` writes the gzip size of every `.js` and `.css` file in `apps/*/dist` to a JSON file, and `report` compares two snapshots and prints a Markdown table: one line per app with the total before and after, then one line per file that is new, removed or different, with before, after and change (bytes below 1 kB, kB above). File names carry a content hash, so the hash is cut (`index-BCMqHVD7.js` becomes `index.js`) to find the same chunk on both sides. In CI, the new step `Bundle size change` runs on pull requests only: it snapshots the `dist` folders of this run, checks out the base branch in a second worktree, builds the four apps there, snapshots them and appends the report to `$GITHUB_STEP_SUMMARY`. Apps that were not affected have no `dist` in this run and are left out of the comparison. The step has `continue-on-error: true`: it informs, the budget is enforced by the `size` target (US3).

**Files.**
- `scripts/ci/bundle-size.ts`, `scripts/ci/bundle-size.test.ts` (new): snapshot, compare, report; 8 tests (name normalisation, snapshot of a temporary `dist`, new/removed/changed files, unchanged files left out, apps without a base build, bytes for small changes).
- `.github/workflows/ci.yml`: step `Bundle size change`.
- `packages/workspace-config/src/ci.test.ts`: two tests for the step.

**How to run.**

```sh
node scripts/ci/bundle-size.ts snapshot --out /tmp/head.json           # after a build
node scripts/ci/bundle-size.ts report /tmp/base.json /tmp/head.json    # base.json from the base branch
pnpm test:scripts && pnpm typecheck:scripts
```

**How to repeat it manually.**

1. `pnpm exec nx run-many -t build` and `node scripts/ci/bundle-size.ts snapshot --out /tmp/base.json`.
2. Add a 6 KB import to `apps/mfe-chat/src/app/ChatListPage.tsx` (as in US3), build again and write `/tmp/head.json`.
3. `node scripts/ci/bundle-size.ts report /tmp/base.json /tmp/head.json`. Expected output: `assets/routes.js` of `mfe-chat` about +5 kB, the app total +5 kB, other apps 0. Undo the change.

**Result.** With the 6 KB import the report shows `mfe-chat` growing from 316.15 kB to 321.43 kB (+1.7%) and, per file, `assets/routes.js` from 60.97 kB to 66.24 kB (+8.7%); the few-byte changes of the entry files come from the hashes of other chunks written into them. The test file passes and the scripts typecheck. The step has not run on GitHub yet: the branch is not pushed.

![Summary table for a deliberate +6 KB import](evidence/05-pr-size-summary.png)

![Unit tests of the script](evidence/06-bundle-size-unit-tests.png)

**Problems and fixes.** The first version printed `+0.00 kB` for changes of a few bytes, which reads as no change; sizes below 1 kB now show in bytes. The base build needs its own `pnpm install` in the second worktree, which adds about a minute to pull request runs; it is the price of an exact before and after, and Nx and pnpm caches of the runner keep it low.

### US5 · Verify shared dependencies load once at runtime ([AICHAT-119](https://ipca-grupo11.atlassian.net/browse/AICHAT-119))

**What and why.** Module Federation shares react, react-dom, the router and Query as singletons. If a remote cannot use the shell's copy it loads its own fallback, and the user downloads the library twice. The e2e suite is not allowed to run for this epic, so we wrote `scripts/ci/shared-deps.ts`, a small check that is not a test run: it signs in a throw-away account, opens `/chats` in headless Chromium (the Playwright library that `e2e/` already has installed), keeps the body of every JavaScript response and looks for one marker string of each library in the bodies (`react.memo_cache_sentinel` for react and react-dom, `No QueryClient set` for Query, `tsr-scroll-restoration` for the router). One file with the marker means one copy; more than one, or none, is reported as `MISMATCH` and the script exits with 1. With `--list` it also prints every JS request, and it lists chunks that have the same name but are loaded from several URLs (these are not shared libraries, see the result). The helpers (`countCopies`, `duplicateChunks`, `formatResult`) have unit tests. It runs by hand against the mock stack and is not part of CI (decision in the DoR review).

**Files.**
- `scripts/ci/shared-deps.ts`, `scripts/ci/shared-deps.test.ts` (new): the check and 4 unit tests (one copy, a second copy as mismatch, duplicate chunk names, report text).

**How to run.**

```sh
pnpm mock:up llm                       # set AUTH_SERVICE_PORT, CONVERSATION_SERVICE_PORT, GRAFANA_PORT, PROMETHEUS_PORT if 4001, 4002, 3300, 9090 are busy
CHECK_PASSWORD='<a password for the throw-away account>' node scripts/ci/shared-deps.ts --list
pnpm mock:down
```

**How to repeat it manually.**

1. Start the stack as above and open `http://localhost:8000/register`, create an account and sign in.
2. Open the browser developer tools, tab Network, filter `JS`, and load `http://localhost:8000/chats`.
3. Look for file names with `prebuild` in them (the remotes' own copies of react-dom, the router and Query, hosts `localhost:3001` to `3003`): expected none. The libraries come once, from `localhost:8000`, in the `loadShare` chunks of the shell.

**Result.** On `/chats` the browser requests 51 JavaScript files. React with react-dom, `@tanstack/react-query` and `@tanstack/react-router` are each in exactly one file, all three served by the shell (`localhost:8000`), and none of the 29 requests to the remotes (`localhost:3001` to `3003`) is a `prebuild` fallback: **the shared dependencies load once, no mismatch**. The remote `mfe-chat` asks only for the small `loadShare` wrappers that connect to the shell's copy. Two things that are not shared-library duplicates showed up and are worth a ticket for the platform owner:

- every container brings its own copy of the federation runtime helpers: `utils-*.js` (about 65 KB raw, 19 KB gzip) is downloaded four times (shell and the three remotes), plus `vite-preload-helper`, `rolldown-runtime` and `helpers` four times each, so about 57 KB gzip is downloaded twice or more;
- `remoteEntry.js` of `mfe-auth` and `mfe-settings` (and their helpers) are fetched on `/chats` as well, because the shell registers all remotes at start-up, not only the one the route needs.

This also explains the budget: the "shared-library copies" group of the remotes (up to 137 kB gzip) is emitted but never downloaded while the shell provides the libraries, which is why US1 keeps it apart from the application chunks.

![JS requests on /chats and the shared-once verdict](evidence/07-shared-deps-once.png)

![Unit tests of the check](evidence/08-shared-deps-unit-tests.png)

**Problems and fixes.** The first idea, counting `prebuild` and `loadShare` in the file names, is not enough: the shell's own `loadShare` chunk is the real copy, while in a remote it is only a wrapper, so a name count would flag a false duplicate. Looking at the code of the response is stricter and does not depend on the naming of the Module Federation plugin. The `__FEDERATION__` share state of the page reported every entry as `loaded: false` after the page was idle, so it could not be used as evidence. Ports 4001, 4002, 3300 and 9090 were busy on the development machine (another project), so the stack ran on 14001, 14002, 13300 and 19090; the stack was removed afterwards (`pnpm mock:down`).

## 4. How to run everything

```sh
pnpm exec nx run-many -t build size                                   # budgets of the four apps (US1, US2, US3)
pnpm exec nx affected -t lint typecheck test build size --base=origin/integration/testing-epics   # what CI runs
node scripts/ci/bundle-size.ts snapshot --out /tmp/head.json          # sizes per file; "report base.json head.json" compares two (US4)
pnpm test:scripts && pnpm typecheck:scripts                           # unit tests of the scripts
pnpm mock:up llm                                                      # US5: set the *_PORT variables if 4001, 4002, 3300, 9090 are busy
CHECK_PASSWORD='<throw-away password>' node scripts/ci/shared-deps.ts --list
pnpm mock:down
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| Bundle budget | none | 20 limits (5 groups x 4 apps) in `apps/*/.size-limit.ts`, checked by the `size` Nx target |
| CI on a bundle over its limit | green | `nx affected` fails (a deliberate 50 KB import took the chat route chunks from 63.07 kB to 102.28 kB, limit 70 kB) |
| Size change on a pull request | not shown | per-app and per-file before/after table in the job summary |
| `remoteEntry.js` (gzip) | about 6 kB, unchecked | 6.1 to 6.3 kB, limit 7 kB |
| Application code (gzip) | unchecked | shell 51.5 kB, auth 24.8 kB, chat 63.1 kB, settings 25.8 kB |
| Shared libraries on `/chats` | not verified | react + react-dom, Query and router each loaded once, from the shell; no remote fallback downloaded |
| Federation runtime helpers on `/chats` | not noticed | `utils-*` (19 kB gzip) downloaded 4 times; to be ticketed |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| Limits recorded with the measured baseline (AICHAT-47) | ✅ | table in US1, [measurement](evidence/01-baseline-measurement.png) |
| size-limit config for shell and 3 remotes, target passes (AICHAT-65) | ✅ | [size target](evidence/02-size-target-passes.png) |
| `size` in `nx affected`, a deliberate +50 KB import fails the job (AICHAT-83) | ✅ | [failing run](evidence/03-deliberate-over-limit-fails.png), [CI spec](evidence/04-ci-spec.png) |
| Required check | ➖ | Not enforceable: branch protection is unavailable on this private free-plan repository. Team rule: no merge with a red `nx affected` job |
| Before/after per file on each pull request (AICHAT-101) | ✅ | [summary](evidence/05-pr-size-summary.png), [tests](evidence/06-bundle-size-unit-tests.png); the CI step has not run on GitHub yet |
| Network check on `/chats`, result recorded, mismatch reported (AICHAT-119) | ✅ | [result](evidence/07-shared-deps-once.png), [tests](evidence/08-shared-deps-unit-tests.png) |
| Unit tests for new scripts | ✅ | evidence 06 and 08 |
| Lint, typecheck, test, build, size of affected projects | ✅ | section 7 |
| SAST and secret scan | ✅ | section 7 |
| Documentation | ✅ | header of each `.size-limit.ts` and of the scripts, this log |

## 7. Notes for the report

- **Checks before the pull request.** CHECKS_PLACEHOLDER
- **Found.** The application code is small (25 to 63 kB gzip per app); the federation glue (114 to 123 kB) and the copies of the shared libraries (88 to 124 kB) are bigger than the application. The copies in the remotes are never downloaded while the shell provides the libraries (US5), so the budget keeps them in their own group. The federation runtime helpers are downloaded once per container (4 times `utils-*`, about 57 kB gzip of repeat downloads), and the shell registers all remotes at start-up, so `mfe-auth` and `mfe-settings` are fetched on `/chats` as well. Both are tickets for the platform owner, not changes of this epic.
- **Not done.** The `Bundle size change` step and the new `size` target have not run on GitHub yet (the branch is not pushed), so a Linux-only difference can still show up in the first run; the base build in the second worktree adds the time of a second `pnpm install` and a build to pull request runs. The check on `/chats` is manual and not in CI. Gzip sizes differ by a few bytes between machines and zlib versions; the limits have a 10% margin for that.
- **Lessons.** Measure by group, not in total: a total hides growth of the application behind the glue. Content hashes in file names have to be cut before two builds are compared. size-limit counts 1 kB as 1000 bytes. Look at the code of the responses, not at file names, to prove a library is loaded once.
