# Plan: `shell` pod

Domain: Host application — layout, routing, module federation, auth guard, resilience.
Owns `apps/shell/` only (see note below on `ARCHITECTURE.md` drift). No backend service
in this pod — all tasks are frontend.

Stories covered: US-7, US-8, US-9 (`docs/BACKLOG.json`, pod `shell`).

## Note on ownership vs. `ARCHITECTURE.md`

`docs/ARCHITECTURE.md` §1/§2 (written before the pod split in `BACKLOG.json`) lists
`apps/shell/` under a single `platform` pod. `docs/BACKLOG.json` instead gives `shell`
its own pod with its own stories (US-7..US-9), separate from `platform-foundation`
(US-1..US-4). This plan follows `BACKLOG.json` as authoritative: **the `shell` pod owns
`apps/shell/`**; `platform-foundation` owns Nx/pnpm/CI/Docker Compose/`packages/*`. The
integrating Tech Lead should reconcile this note into `ARCHITECTURE.md` at integration
time.

## Cross-pod dependencies (assumptions, to reconcile at integration)

The shell is built in isolation from `auth`, `chat`, `configuration` (which own
`mfe-auth`, `mfe-chat`, `mfe-settings`), and from `platform-foundation` (which owns
`packages/ui`, `packages/shared-types`, `packages/tsconfig`, `packages/eslint-config`,
and the Nx/pnpm workspace root). Tasks below assume:

- **Workspace root exists** (`pnpm-workspace.yaml`, root `package.json`, `nx.json`,
  `packages/tsconfig`, `packages/eslint-config`) so `apps/shell` can add itself as a
  workspace project. If these are not yet present in this worktree, each task creates
  the minimal local config it needs (own `tsconfig.json`, own ESLint config extending a
  relative path or inline rules) so the app still lints/typechecks/builds standalone;
  the integrator wires it into the shared root config.
- **`packages/ui`** exports the design-system primitives listed in SPEC §3.4 (Button,
  Card, Tabs, etc.) via a package entry point `@app/ui` (or workspace-equivalent). Shell
  layout/nav code (task FE-2) imports only from there — no ad-hoc primitive markup
  (AC-18 is owned by other pods but the shell must not violate it).
- **`packages/shared-types`** exports: the `CORRELATION_HEADER` constant, a `Session`/
  `AuthMeResponse` DTO for `GET /auth/me`, and the `X-Llm-Api-Key`/error DTO shapes used
  by chat. If not yet available, task FE-3 defines a local `model/session.ts` type as a
  stand-in with a `// TODO(integration): replace with packages/shared-types` comment.
- **Module Federation remote conventions** (proposed here for cross-pod alignment;
  confirm with `auth`/`chat`/`configuration` pods at integration):
  | Remote | Federation name | Dev port | Remote entry | Exposed module |
  |---|---|---|---|---|
  | `mfe-auth` | `mfeAuth` | 5001 | `http://localhost:5001/remoteEntry.js` | `./routes` |
  | `mfe-chat` | `mfeChat` | 5002 | `http://localhost:5002/remoteEntry.js` | `./routes` |
  | `mfe-settings` | `mfeSettings` | 5003 | `http://localhost:5003/remoteEntry.js` | `./routes` |
  | `shell` (host) | `shell` | 5000 | n/a | n/a |
  Each remote's `./routes` module default-exports a TanStack Router route (or array of
  routes) for that domain. Shared singletons: `react`, `react-dom`,
  `@tanstack/react-router`, `@tanstack/react-query`, and the design-system package.
  Remote URLs are read from Vite env vars (`VITE_MFE_AUTH_URL`, `VITE_MFE_CHAT_URL`,
  `VITE_MFE_SETTINGS_URL`) with the localhost defaults above, so `platform-foundation`'s
  `.env.example`/Docker Compose can override them per environment.

## Feature-folder public APIs (contracts between tasks below)

Per SPEC §3.3, features only import each other's `index.ts`. To let FE-2/FE-3/FE-4 be
built in parallel, the exported surface of each feature is fixed here:

- `features/auth-guard` exports:
  - `useSession(): { data: Session | undefined; isLoading: boolean; isAuthenticated: boolean }`
  - `RequireAuth({ children }: { children: ReactNode }): JSX.Element` — renders
    `children` when authenticated, renders nothing and navigates to `/login` (preserving
    the intended URL for post-login redirect) when not.
- `features/remote-loader` exports:
  - `createRemoteRoute(scopeName: string, loader: () => Promise<{ default: ComponentType }>): ComponentType`
    — returns a component that lazy-loads `loader` inside a `Suspense` fallback and a
    scoped error boundary keyed by `scopeName`.
  - `RemoteErrorBoundary({ scopeName, children }): JSX.Element` (used directly where
    finer control than `createRemoteRoute` is needed).

## Tasks

### FE-1: Nx project scaffold + Module Federation host config
Covers: AC-22, AC-24.

Owns (creates):
- `apps/shell/project.json` (Nx targets: `lint`, `typecheck`, `test`, `build`, `serve`)
- `apps/shell/package.json`
- `apps/shell/vite.config.ts` (`@module-federation/vite` host config: remotes table
  from the convention above, `shared: { react, react-dom, @tanstack/react-router,
  @tanstack/react-query, <design-system pkg> }` all singleton)
- `apps/shell/tsconfig.json`, `apps/shell/tsconfig.app.json`
- `apps/shell/index.html`
- `apps/shell/src/main.tsx`, `apps/shell/src/vite-env.d.ts`
- `apps/shell/.env.local.example` (documents `VITE_MFE_*_URL` overrides)

Notes: no dependency on other FE tasks; must land first since FE-2/FE-3/FE-4 add files
under `apps/shell/src/`. Include a placeholder `App.tsx` rendering "Shell OK" so the app
builds/serves before routing lands.

### FE-2: Routing and layout shell
Covers: AC-23.

Owns (creates):
- `apps/shell/src/app/router.ts` (TanStack Router instance + generated route tree
  wiring; file-based routes under `src/routes/`)
- `apps/shell/src/routes/__root.tsx` (root layout: nav + `<Outlet/>`, wraps app in
  `QueryClientProvider` using the client from FE-3's `app/queryClient.ts`)
- `apps/shell/src/routes/index.tsx` (redirect `/` → `/chats`)
- `apps/shell/src/routes/login.tsx` — mounts `mfeAuth`'s `./routes` via
  `createRemoteRoute('auth', () => import('mfeAuth/routes'))`
- `apps/shell/src/routes/chats.tsx`, `apps/shell/src/routes/chats.$chatId.tsx` — wrapped
  in `features/auth-guard`'s `RequireAuth`, mount `mfeChat/routes` via
  `createRemoteRoute('chat', ...)`
- `apps/shell/src/routes/settings.tsx` — wrapped in `RequireAuth`, mounts
  `mfeSettings/routes` via `createRemoteRoute('settings', ...)`
- `apps/shell/src/shared/layout/AppShellLayout.tsx`, `NavBar.tsx`, `index.ts` (nav links
  to Chats/Settings/Logout, built only from design-system components per SPEC §3.4/AC-18)
- `apps/shell/src/routeTree.gen.ts` (generated by TanStack Router CLI/plugin; committed
  as build output, not hand-edited)

Depends on: FE-1 (scaffold). Consumes the `features/auth-guard` and
`features/remote-loader` public APIs defined above (implemented in FE-3/FE-4) — can be
written in parallel against those signatures; wire-up compiles once all three land.

### FE-3: Shared TanStack Query client, HTTP client, and auth guard
Covers: AC-25, AC-26.

Owns (creates):
- `apps/shell/src/app/queryClient.ts` (single `QueryClient` instance, exported for the
  shell and, per AC-25, importable by remotes as a federation-shared singleton so
  `mfe-auth`/`mfe-chat`/`mfe-settings` reuse it rather than creating their own)
- `apps/shell/src/shared/http/apiClient.ts` (fetch wrapper: `credentials: 'include'` for
  cookie auth, attaches `X-Correlation-Id` header — generating a UUID when absent per
  `ARCHITECTURE.md` §7 — and normalizes 401 responses)
- `apps/shell/src/features/auth-guard/model/session.ts` (Session type; stand-in for
  `packages/shared-types` `AuthMeResponse` if unavailable, marked TODO as above)
- `apps/shell/src/features/auth-guard/api/useSession.ts` (TanStack Query hook calling
  `GET /auth/me` on `auth-service` via `apiClient`; treats 401 as
  `isAuthenticated: false` rather than an error)
- `apps/shell/src/features/auth-guard/components/RequireAuth.tsx`
- `apps/shell/src/features/auth-guard/index.ts` (public API: `useSession`, `RequireAuth`)
- `apps/shell/src/features/auth-guard/RequireAuth.test.tsx` — Vitest + Testing Library:
  redirects to `/login` when session query resolves unauthenticated; renders children
  when authenticated; also covers AC-41-adjacent "expired session" case (401 mid-session
  triggers redirect) as a shell-side unit test.

Depends on: FE-1 (scaffold). Independent of FE-2/FE-4 files (different folders);
`auth-service`'s `/auth/me` contract is owned by the `auth` pod — mock it in tests via
MSW/fetch mock rather than a live call.

### FE-4: Remote loader with per-remote failure isolation
Covers: AC-27, AC-28, AC-29.

Owns (creates):
- `apps/shell/src/features/remote-loader/model/loadRemote.ts` (wraps a federated dynamic
  `import()` and normalizes/tags load failures with the remote's `scopeName`)
- `apps/shell/src/features/remote-loader/components/RemoteErrorBoundary.tsx` (React
  error boundary; on catch, renders `RemoteFallback` for that scope only — does not
  unmount the rest of the app/nav)
- `apps/shell/src/features/remote-loader/components/RemoteFallback.tsx` (scoped error UI
  built from design-system components: message + retry action)
- `apps/shell/src/features/remote-loader/createRemoteRoute.tsx` (combines `loadRemote` +
  `Suspense` + `RemoteErrorBoundary`)
- `apps/shell/src/features/remote-loader/index.ts` (public API: `createRemoteRoute`,
  `RemoteErrorBoundary`)
- `apps/shell/src/features/remote-loader/RemoteErrorBoundary.test.tsx` — Vitest +
  Testing Library: mocks a federated `import()` that rejects, asserts (a) the scoped
  fallback renders instead of a full-app crash, (b) a sibling nav/route outside the
  failed scope still renders/works (AC-27, AC-28, AC-29).

Depends on: FE-1 (scaffold). Independent of FE-2/FE-3 files (different folder).

## Suggested execution order

1. FE-1 (blocks everything else).
2. FE-3 and FE-4 in parallel (disjoint `features/` folders).
3. FE-2 last, wiring routes to the `features/auth-guard` and `features/remote-loader`
   public APIs from FE-3/FE-4.

## Out of scope for this pod

- Implementing `mfe-auth`, `mfe-chat`, `mfe-settings` themselves (owned by `auth`,
  `chat`, `configuration` pods).
- `packages/ui`, `packages/shared-types`, Nx/pnpm workspace root, Docker Compose, CI
  (owned by `design-system`/`platform-foundation`).
- Token refresh mechanics and `/auth/me` implementation (owned by `auth` pod) — the
  shell only consumes the endpoint.
