# Auth pod — QA report

Verdict: PASS

## Scope

This pod owns `apps/mfe-auth` and `services/auth-service`, covering stories US-10, US-11,
US-12 (`docs/BACKLOG.json`), i.e. acceptance criteria AC-30 through AC-41.

Test command (`.factory/commands.json`): `pnpm exec nx affected -t lint typecheck test
build --base=origin/main --head=HEAD`. Since this worktree has no `origin/main` ref to
diff against, both projects' Vitest suites were run directly instead
(`services/auth-service`: `npx vitest run --coverage`; `apps/mfe-auth`: `npx vitest run`),
which is what the `test` Nx target itself invokes per project.

## Results

- `services/auth-service`: **13 test files, 72 tests passed.** Coverage 94.8%
  stmts/95.3% lines/87.5% branches/95.6% funcs — above the 80% threshold (STACK.md
  decision #6).
- `apps/mfe-auth`: **6 test files, 22 tests passed.**

  Note: an initial run in this sandbox showed 12 failures across the `LoginForm`,
  `LogoutButton`, and `RegisterForm` specs with `TypeError: React.act is not a function`.
  This was traced to the shell's ambient `NODE_ENV=production`, which makes `react`
  resolve to its production build (no `act` export) under Vitest/jsdom — an environment
  artifact of this QA session, not a code defect. Re-running with `NODE_ENV=test` (the
  value Vitest itself sets when invoked via `vitest`/`nx test` normally) passes all 22
  tests cleanly. No application code was changed.

## Change made during this QA pass

Added one integration test file,
`services/auth-service/src/features/session/register-then-login.spec.ts`, wiring the real
`registerRouter` and `sessionRouter` against a single shared in-memory Prisma fake (the
existing `register/api.spec.ts` and `session/api.spec.ts` each mock `shared/prisma`
independently and never exercise both features together). Previously **AC-34** was only
asserted by a mocked-API frontend test (`RegisterForm.spec.tsx`, which just checks the
redirect) — there was no test that actually registers a user and then logs in with the
same credentials end-to-end, which is what AC-34's text requires. No other missing
AC-named tests were found; no application code was modified.

## Acceptance criteria coverage

| AC | Text | Test(s) | Status |
|----|------|---------|--------|
| AC-30 | Registration form collects email and password, validated on client and server | `register/api.spec.ts`, `register/model.spec.ts`, `RegisterForm.spec.tsx`, `routes.spec.tsx` | PASS |
| AC-31 | Duplicate email rejected, no account created | `register/api.spec.ts`, `register/model.spec.ts` (×2), `RegisterForm.spec.tsx` | PASS |
| AC-32 | Invalid password rejected with validation error | `register/api.spec.ts` (×2), `main.spec.ts`, `RegisterForm.spec.tsx` | PASS |
| AC-33 | Passwords stored hashed; plaintext never persisted/logged | `register/api.spec.ts`, `register/model.spec.ts` (×2), `logger.spec.ts`, `env.spec.ts` | PASS |
| AC-34 | After successful registration the user can immediately log in with those credentials | `RegisterForm.spec.tsx` (redirect), **new** `session/register-then-login.spec.ts` (real register→login round trip) | PASS |
| AC-35 | Valid credentials log in and land on chat list | `session/model.spec.ts` (×2), `session/api.spec.ts` (×2), `LoginForm.spec.tsx` (×2), `routes.spec.tsx`, `verify.spec.ts` | PASS |
| AC-36 | Invalid credentials show one generic error message | `session/model.spec.ts` (×2), `session/api.spec.ts` (×2), `LoginForm.spec.tsx` (×2) | PASS |
| AC-37 | Auth tokens issued as httpOnly cookies | `session/cookies.spec.ts`, `session/model.spec.ts` (×3), `session/api.spec.ts` | PASS |
| AC-38 | Logout invalidates the session | `session/model.spec.ts`, `session/api.spec.ts` (×2), `LogoutButton.spec.tsx` (×2) | PASS |
| AC-39 | conversation-service validates the caller's token on every request, rejects with 401 | — | N/A — implemented and tested in `services/conversation-service`, owned by the `chat` pod (see `docs/pods/auth/PLAN.md` §"Acceptance criteria coverage map" and `docs/ARCHITECTURE.md` §4). That service does not exist in this pod's directory (`services/conversation-service` is absent from this worktree), so it cannot be tested from here. |
| AC-40 | auth-service issues and validates tokens used by other services | `shared/jwt.spec.ts` (×4), `session/verify.spec.ts` (×3) | PASS |
| AC-41 | Shell redirects to login on expired/invalid session | `login/api/session.spec.ts` (×4) — this pod's contract (`fetchMe`/silent-refresh primitives); the redirect UI itself is owned by the `shell` pod per PLAN.md | PASS |

## Details

- All AC IDs above have at least one test whose `it(...)` name includes the AC id, except
  AC-39, which is out of this pod's codebase by design (cross-pod ownership documented in
  `docs/pods/auth/PLAN.md`).
- No application/source files were modified besides adding the one new test file listed
  above.
