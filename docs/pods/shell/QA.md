# QA: `shell` pod

Verdict: PASS

## Test command

The canonical command in `.factory/commands.json` is:

```
pnpm exec nx affected -t lint typecheck test build --base=origin/main --head=HEAD
```

This pod's worktree contains only `apps/shell/` (no root `nx.json`/`pnpm-workspace.yaml` —
see `docs/pods/shell/PLAN.md`'s note on building in isolation from
`platform-foundation`), so `nx affected` cannot run here
(`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "nx" not found`). This is an expected
consequence of the pod-worktree split (the Nx/pnpm workspace root is owned by
`platform-foundation`), not a defect in this pod. I instead ran the equivalent local
project targets directly inside `apps/shell/` (the same commands `apps/shell/project.json`
wires to the `lint`/`typecheck`/`test`/`build` Nx targets):

```
pnpm exec vitest run       # test target
pnpm exec tsc -b --noEmit  # typecheck target
pnpm exec eslint src       # lint target
pnpm exec vite build       # build target
```

Results:
- `vitest run` → **19 passed / 19** (5 test files). ✅
- `tsc -b --noEmit` → clean, no errors. ✅
- `vite build` → succeeds, emits `dist/` incl. `remoteEntry.js`. ✅
- `eslint src` → fails to start (see "Other findings" below); not a lint violation in
  the source, and not tied to any acceptance criterion.

## Acceptance criteria coverage

| AC | Text (abridged) | Test(s) | Status |
|---|---|---|---|
| AC-22 | Shell is a Vite MF host that lazy-loads mfe-auth, mfe-chat, mfe-settings as remotes at runtime | `src/app/remoteWiring.test.ts` (5 tests), `src/app/moduleFederationConfig.test.ts` (2 tests) | **PASS** |
| AC-23 | Top-level TanStack Router routes are type-safe and file-based, defined in the shell | `src/app/router.test.ts` (3 tests) | **PASS** |
| AC-24 | React, ReactDOM, TanStack Router, TanStack Query, and the design system are shared as singletons | `src/app/moduleFederationConfig.test.ts` (3 tests, incl. "the design system package is shared as a singleton across host and remotes") | **PASS** |
| AC-25 | Shell exposes a shared TanStack Query client used by all remotes | `src/features/auth-guard/RequireAuth.test.tsx` ("AC-25/AC-26: renders children once the session query resolves authenticated") | **PASS** |
| AC-26 | Unauthenticated users navigating to chat/configuration routes are redirected to `/login` | `src/features/auth-guard/RequireAuth.test.tsx` (3 tests, incl. mid-session 401 expiry) | **PASS** |
| AC-27 | A failing remote renders a scoped error state for that area only | `src/features/remote-loader/RemoteErrorBoundary.test.tsx` (3 tests, incl. retry) | **PASS** |
| AC-28 | The rest of the app keeps working when one remote fails | `src/features/remote-loader/RemoteErrorBoundary.test.tsx` ("AC-27/AC-28: a failed remote import renders a scoped fallback instead of a full-app crash") | **PASS** |
| AC-29 | A test simulates a remote load failure and verifies graceful degradation | `src/features/remote-loader/RemoteErrorBoundary.test.tsx` ("AC-29: a sibling route outside the failed scope keeps working while one remote is down") | **PASS** |

Every AC (AC-22..AC-29, per `docs/BACKLOG.json`'s `shell` pod / US-7, US-8, US-9) has at
least one test whose name includes its id, and the full suite passes (19/19). No tests
needed to be added by this QA pass — the suite already had full, passing AC-named
coverage (a prior QA pass had flagged 8 failures caused by a `React.act is not a
function` environment issue and a missing design-system federation entry; both have
since been fixed in `apps/shell/vite.config.ts` `test.env.NODE_ENV` and
`module-federation.config.ts`'s `shared` map, and are now verified passing).

## Other findings (not test-coverage gaps, noted for completeness)

- `pnpm exec eslint src` fails immediately at startup: `typescript-eslint does not
  support TS 7.0` (installed `typescript` is `7.0.2`; installed `typescript-eslint` is
  `8.70.1`, which only supports TypeScript up to the 6.x line). This is a dependency
  version incompatibility in `apps/shell/package.json`'s devDependencies, not a lint
  violation in `src/`; it blocks the `lint` Nx target from running at all. Per QA scope
  ("do not fix application code"), this is flagged for the pod owner rather than fixed
  here — bumping `typescript-eslint` to a TS-7-compatible release (or pinning
  `typescript` to `^6.x`) would resolve it.
- `vitest run --coverage` (not part of the `test` Nx target, which runs plain
  `vitest run`) shows overall coverage below the `vite.config.ts` `test.coverage.thresholds`
  (80/80/80/80): 71.18% statements / 61.03% branches / 67.34% functions / 70.94% lines,
  driven mainly by untested UI in `src/routes/*.tsx`, `src/shared/http/apiClient.ts`, and
  `src/shared/layout/*`. None of these gaps map to an unmet acceptance criterion (all
  AC-22..AC-29 behaviors are covered as shown above), so this doesn't change the verdict,
  but is noted since the coverage thresholds are configured and would fail a
  `vitest run --coverage` invocation.
