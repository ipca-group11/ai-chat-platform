# Auth pod plan

Domain: Authentication — registration, login, logout, session/token validation.
Owns `apps/mfe-auth` (frontend) and `services/auth-service` (backend). See
`docs/ARCHITECTURE.md` §4 for the auth architecture and `docs/STACK.md` decisions #1, #2,
#4, #8 for token/cookie/password-policy/correlation-id decisions this plan implements.

This pod may only edit paths under `apps/mfe-auth/`, `services/auth-service/`, and
`docs/pods/auth/`. Any change to `packages/shared-types` (e.g. password-policy Zod
schema, auth DTOs, correlation header constant) must be proposed as an additive change
and coordinated with `platform`, since that package is platform-owned.

Stories covered: US-10, US-11, US-12 (`docs/BACKLOG.json`, pod `auth`).

## Backend tasks (`services/auth-service`)

### B1 — Service scaffold, Prisma schema, Postgres connection
Files:
- `services/auth-service/package.json`, `project.json` (Nx targets: lint, typecheck,
  test, build, serve), `tsconfig.json`
- `services/auth-service/prisma/schema.prisma` (`User { id, email (unique), passwordHash,
  createdAt }`, `RefreshToken { id, userId, tokenHash, expiresAt, rotatedFrom, revokedAt,
  createdAt }`)
- `services/auth-service/src/main.ts` (Express app bootstrap: `helmet`, `cors` with
  credentials, `express-rate-limit`, JSON body parsing, cookie parsing, correlation-id
  middleware, `pino` structured logging with redaction of `password`/`token`/`Authorization`
  fields, `/metrics` via `prom-client`, `/health`)
- `services/auth-service/src/shared/` (Prisma client singleton, env config loader, error
  middleware, correlation-id middleware reading/generating `X-Correlation-Id`)

Covers: infrastructure for AC-33, AC-88, AC-89, AC-90 (this pod's slice of logging/redaction
for its own service; Prometheus/Grafana wiring itself is `platform`'s AC-91/92/93).

### B2 — Register feature (`src/features/register/`)
Files: `services/auth-service/src/features/register/{model,api,index}.ts` (+ tests)
- Zod validation of email + password using the shared password-policy schema from
  `packages/shared-types` (propose the schema there if not already present; fall back to
  an equivalent local schema only if `platform` hasn't landed it yet, then switch to the
  shared one).
- `POST /auth/register`: rejects duplicate email (case-insensitive) with a 409 + single
  validation error; rejects a password not meeting policy with a 400 + validation error;
  hashes password with `bcrypt` before persisting via Prisma; never logs or returns the
  plaintext password.
- Unit tests (Vitest): duplicate email, weak password, success path, hash verification,
  ensures plaintext password never appears in logger calls (mock/spy on logger).

Covers: AC-30, AC-31, AC-32, AC-33, AC-34 (AC-34 verified end-to-end together with B3's
login).

### B3 — Login/logout/session feature (`src/features/session/`)
Files: `services/auth-service/src/features/session/{model,api,index}.ts` (+ tests)
- `POST /auth/login`: verifies credentials with `bcrypt.compare`; on failure returns one
  generic error (`"Invalid email or password"`) regardless of which field was wrong,
  same status/shape for unknown email vs wrong password.
- On success issues access token (JWT HS256, `JWT_SECRET` env, 15 min TTL, claims `{sub,
  email, iat, exp}`) as `httpOnly`, `Secure`, `SameSite=Lax` cookie `access_token`, and a
  refresh token (opaque random value, 7 day TTL, stored hashed in `RefreshToken`) as
  `httpOnly`, `Secure`, `SameSite=Lax` cookie `refresh_token` scoped to `/auth`.
- `POST /auth/refresh`: validates refresh cookie against stored hash, rejects if
  expired/revoked/reused, rotates (marks old row revoked, issues + stores new refresh
  token), issues new access token.
- `POST /auth/logout`: revokes the current refresh token row and clears both cookies so
  subsequent requests using them are rejected.
- `GET /auth/me`: returns the current user (id, email) if the access token cookie is
  valid, else 401 — used by the shell's auth guard (AC-26, owned by `shell` pod, but this
  endpoint is this pod's contract to provide).
- Unit tests: valid login, invalid email, invalid password (same generic message +
  status for both), cookie flags (`httpOnly`/`Secure`/`SameSite`) present on
  login/refresh, logout revokes refresh token and a reused/rotated-out refresh token is
  rejected, `/auth/me` 401 after logout.

Covers: AC-35, AC-36, AC-37, AC-38.

### B4 — Token verification module consumed by other services (`src/features/session/verify.ts`)
Files: `services/auth-service/src/features/session/verify.ts`,
`services/auth-service/src/shared/jwt.ts` (+ tests), plus an exported helper published
via `packages/shared-types` (e.g. `verifyAccessToken(token, secret)` type/contract, or at
minimum the JWT claims shape + `JWT_SECRET` env var name documented) so
`conversation-service` (owned by `chat` pod) can validate access tokens locally without a
network call, per `docs/ARCHITECTURE.md` §4.
- Exposes a small reusable JWT sign/verify utility (used internally by B3) with unit
  tests: valid token verifies, expired token throws/returns invalid, tampered signature
  is rejected.
- Document in this file's header comment and in `docs/pods/auth/PLAN.md` (this file) the
  contract other services need: cookie name `access_token`, JWT claims shape, shared
  `JWT_SECRET` env var, so `chat` pod's AC-39/AC-40 can be implemented against it.

Covers: AC-40 (auth-service issues and validates tokens used by other services — issuance
is B3, the reusable local-verification contract is B4). AC-39 (conversation-service
enforcing 401) is implemented by the `chat` pod against this contract, not by this pod.

## Frontend tasks (`apps/mfe-auth`)

### F1 — Remote scaffold and Module Federation exposure
Files:
- `apps/mfe-auth/package.json`, `project.json` (Nx targets: lint, typecheck, test, build,
  serve), `tsconfig.json`, `vite.config.ts` (Module Federation remote config exposing
  `/login`, `/register` routes/entry per `docs/ARCHITECTURE.md`; React/React DOM/Router/
  Query/design-system as shared singletons per AC-24, coordinated with `shell`/`platform`
  which owns the host config)
- `apps/mfe-auth/src/main.tsx`, `src/shared/` (API client using `credentials: 'include'`
  so httpOnly cookies are sent, correlation-id header injection using the shared constant
  from `packages/shared-types`)

Covers: infrastructure prerequisite for AC-22 (host-side wiring is `shell`/`platform`'s
responsibility; this task only covers the remote's own exposure).

### F2 — Registration form (`src/features/register/`)
Files: `apps/mfe-auth/src/features/register/{components,hooks,api,model,index}.ts` (+
tests)
- Registration form built only from `packages/ui` primitives (Input, Label, Form field,
  Button, Card, Toast) — no ad-hoc markup, per design-system pod's AC-18.
- Client-side validation using the same shared Zod password-policy/email schema as
  `auth-service` (from `packages/shared-types`), showing field-level errors before
  submit.
- `useRegister` TanStack Query mutation hook calling `POST /auth/register`; surfaces
  server validation errors (duplicate email, weak password) inline; on success redirects
  to `/login` (or auto-login flow if product decides, defaulting to redirect to login per
  UC1).
- Tests: Vitest + Testing Library — renders, client validation blocks submit on bad
  input, duplicate-email server error displayed, success redirects.

Covers: AC-30 (client half; server half is B2), AC-31, AC-32 (displayed messages), AC-34
(navigates to a working login form).

### F3 — Login form and logout action (`src/features/login/`)
Files: `apps/mfe-auth/src/features/login/{components,hooks,api,model,index}.ts` (+ tests)
- Login form using `packages/ui` primitives; on success navigates to the chat list route
  (`/chats`, owned by `chat`/`shell` — this pod only triggers the navigation via the
  shared router).
- On invalid credentials, shows the single generic error message returned by the API
  as-is (no client-side guessing of which field is wrong).
- `useLogout` mutation calling `POST /auth/logout`, then redirects to `/login` and clears
  any cached TanStack Query state that could leak the previous session.
- Tests: valid login navigates to chat list, invalid login shows the generic message,
  logout clears session and redirects.

Covers: AC-35, AC-36, AC-38 (frontend half — invalidating the session server-side is B3).

### F4 — Session/expiry handling contract for the shell guard
Files: `apps/mfe-auth/src/features/login/api/session.ts` (or `shared/session.ts`) (+
tests)
- Exposes a small reusable helper/hook (e.g. `useSession`/`fetchMe` wrapping `GET
  /auth/me`) that `shell`'s auth guard can consume (or that this pod documents as the
  contract if `shell` implements its own call) to detect an expired/invalid session and
  a silent-refresh call wrapping `POST /auth/refresh`.
- Tests: 401 from `/auth/me` surfaces as "not authenticated"; successful refresh retried
  once on a 401 before giving up.

Covers: contract underpinning AC-41 (the actual redirect-on-expiry UI behavior lives in
`shell`'s auth guard, owned by the `shell` pod; this task delivers the session-check/
refresh primitives it depends on).

## Acceptance criteria coverage map

| AC | Task |
|----|------|
| AC-30 | B2, F2 |
| AC-31 | B2, F2 |
| AC-32 | B2, F2 |
| AC-33 | B1, B2 |
| AC-34 | B2, B3, F2 |
| AC-35 | B3, F3 |
| AC-36 | B3, F3 |
| AC-37 | B3 |
| AC-38 | B3, F3 |
| AC-39 | B4 (contract only — enforced in `conversation-service`, owned by `chat` pod) |
| AC-40 | B3, B4 |
| AC-41 | F4 (contract only — redirect UI owned by `shell` pod) |

## Cross-pod dependencies

- `packages/shared-types` (platform-owned): password-policy Zod schema, auth DTOs
  (register/login request/response shapes), correlation header constant, JWT claims
  type. This pod proposes additions via PR; does not edit unilaterally.
- `shell` pod: consumes `GET /auth/me` and `POST /auth/refresh` (F4) for the route guard
  (AC-26, AC-41) and mounts `mfe-auth` as a remote (F1).
- `chat` pod: `conversation-service` must verify access tokens using the same
  `JWT_SECRET`/claims contract documented in B4 to satisfy AC-39.
- `JWT_SECRET`, Postgres connection string, and cookie domain/secure settings are
  env-driven; this pod documents the variables it needs in its service's `.env.example`
  entries, to be merged into the root `.env.example` owned by `platform`.

## Test plan (per task)
Each backend task ships Vitest unit tests colocated under
`services/auth-service/src/features/<feature>/**/*.spec.ts` covering the acceptance
criteria listed above, with `bcrypt`/Prisma mocked or an in-memory/test Postgres per the
project's Vitest setup; coverage must meet the 80% line threshold (STACK.md decision #6).
Each frontend task ships Vitest + Testing Library tests colocated under
`apps/mfe-auth/src/features/<feature>/**/*.spec.tsx`. Pact consumer contract tests for
`mfe-auth` ↔ `auth-service` are added alongside F2/F3/B2/B3 to satisfy AC-95 (owned
cross-cutting by `quality-observability`, but authored here since this pod owns both
sides of the contract). E2E coverage of UC1/UC2 is `quality-observability`'s
responsibility (AC-98) and is out of scope for this pod's tasks, though this pod's routes
must be stable enough to support it.
