### US5 · Unit tests for every source file of the shell ([AICHAT-105](https://ipca-grupo11.atlassian.net/browse/AICHAT-105))

**What and why.** The shell had 13 source files without a test and ran with the coverage thresholds that AICHAT-34 had lowered
(70/60/62/68). We wrote a test next to each file and put the shell back on the standard thresholds. The tests use MSW through
`@platform/test-utils/msw` for every HTTP call, with no `fetch` stub.

- Logic: `queryClient` (defaults, singleton, one retry), `useSession` (user, `{ user }` envelope, 401 as "not signed in", 500 as error, re-check on mount),
  `session` (type-only: the test pins the shape with `expectTypeOf`), `loadRemote` (success, `Error` and non-`Error` rejections, synchronous throw),
  `constants` and `apiClient` (cookies, correlation id generated or kept, base URL, 204, `ApiError`, network failure).
- Components: `RemoteFallback`, `NavBar` (signed in and out, active link, theme toggle with `<html>` class and stored choice), `AppShellLayout` (session in the nav, logout success and failure), `createRemoteRoute`.
- Routes: `index.tsx` and `login.tsx` have logic, so they are tested. The other route files stay on the exempt list.
- Existing tests moved next to the file they test (`RequireAuth.test.tsx`, `RemoteErrorBoundary.test.tsx`), and `mockRemotes.test.tsx` now answers with MSW instead of a `fetch` stub.

**Files.** `apps/shell/src/**/*.test.ts(x)` (new files for the 13 above, plus `shared/test/renderWithRouter.tsx`) and `apps/shell/vite.config.ts`.

**How to run.** `pnpm exec nx test shell` (runs `vitest run --coverage`, so the thresholds are enforced).

**How to repeat it manually.** `cd apps/shell && pnpm exec vitest run --coverage`, then `node scripts/unit-test/source-files.mjs --list | grep NO-TEST | grep apps/shell/`: the list is empty.

**Result.**

| Metric | Before | After |
|---|---|---|
| Statements | 68.71 | 92.02 |
| Branches | 60.97 | 87.80 |
| Functions | 62.12 | 86.36 |
| Lines | 70.51 | 92.94 |

Thresholds are back to the standard 80/75/80/80 (the dated TODOs are gone).

![Shell coverage before](evidence/20-shell-coverage-before.png)
![Shell coverage after](evidence/22-shell-coverage-after.png)
![No file without a test](evidence/24-no-test-list-shell-mfe-auth.png)

**Problems and fixes.**
- `@app/ui` resolves to `packages/ui/dist`, so a fresh checkout needs `nx run ui:build` first; running through `nx` does this by itself.
- The TanStack Router plugin treated `routes/*.test.ts` as route files. We added `routeFileIgnorePattern: '\.test\.'` to the shell's Vite config.
- `mfeAuth/routes` cannot be resolved by Vitest, so the `/login` test checks `validateSearch` and the parsed search of a real URL, not the mounted remote (covered by the e2e suite).
- `shared/test/renderWithRouter.tsx` is a test helper, so it is excluded from coverage.

### US4 · Unit tests for every source file of mfe-auth ([AICHAT-69](https://ipca-grupo11.atlassian.net/browse/AICHAT-69))

**What and why.** Eight source files of `mfe-auth` had no test. The tests check behaviour and the failure paths (validation message from the server, wrong credentials, duplicate email, server error).

- Hooks: `useLogin`, `useRegister` (success, 400 validation, 401/409, 500) and `useLogout` (cache cleared and redirect to `/login`, also when the server answers 500 or 401).
- Models and schemas: `shared/schemas` (email, each password rule, all rules reported together, login only checks presence), `login/model` and `register/model` (same schema object as `shared/schemas`).
- API calls: `login.ts` and `register.ts` (JSON body, cookies, server messages).
- `AuthCard` (title, description, children, real `href`, client-side navigation) and the two indirect files with logic: `correlation` (UUID and the `corr-` fallback) and `navigation` (navigates the router in scope).
- `mfe-auth` already used the standard thresholds (`appCoverageThresholds`), so nothing was lowered or added there.

**Files.** `apps/mfe-auth/src/**/*.spec.ts(x)` next to the files above.

**How to run.** `pnpm exec nx test mfe-auth`.

**How to repeat it manually.** `cd apps/mfe-auth && pnpm exec vitest run --coverage`; `node scripts/unit-test/source-files.mjs --list | grep NO-TEST | grep apps/mfe-auth/` prints nothing.

**Result.**

| Metric | Before | After |
|---|---|---|
| Statements | 92.23 | 98.05 |
| Branches | 75.40 | 85.24 |
| Functions | 93.10 | 96.55 |
| Lines | 92.23 | 98.05 |

![mfe-auth coverage before](evidence/21-mfe-auth-coverage-before.png)
![mfe-auth coverage after](evidence/23-mfe-auth-coverage-after.png)

**Problems and fixes.**
- `useNavigate` from TanStack Router only logs a warning outside a router, it does not throw, so the `navigation` test mounts a real in-memory router and checks that the navigation happens.
- The hooks do not validate input (the forms do, with the schemas), so "validation error" in the hook tests is the 400 answer of the server; the client-side rules are tested in `schemas.spec.ts`.
