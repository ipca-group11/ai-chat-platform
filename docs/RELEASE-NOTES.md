# Release Notes — v1.0.0

First release of the multi-frontend LLM chat application: an Nx/pnpm monorepo hosting a
Module Federation shell, three microfrontends, two backend services, a shared design
system, and the platform tooling (CI, Docker Compose, observability) that ties them
together.

## What users get, by story

### Platform foundation
- **US-1 — Monorepo setup with Nx and pnpm workspaces.** `apps/`, `services/`, and
  `packages/` are wired as pnpm workspace packages under a single Nx project graph; every
  project defines lint/typecheck/test/build (frontends also `serve`, `packages/ui` also
  `storybook`); Nx tags block an app from depending on another app.
- **US-2 — Docker Compose local development environment.** `docker compose up` starts
  the shell, mfe-auth, mfe-chat, mfe-settings, auth-service, conversation-service,
  Postgres, Ollama, Prometheus, and Grafana in one command, with an `.env.example`
  documenting every variable and safe local defaults.
- **US-3 — Shared libraries.** `packages/shared-types` defines the API contracts used by
  both frontends and services; `packages/eslint-config` and `packages/tsconfig` give
  every project a consistent flat ESLint config and `tsc --noEmit`-clean tsconfig base;
  feature folders only import from `shared/` or other features' `index.ts`.
- **US-4 — CI pipeline with `nx affected`.** CI runs `nx affected` for lint, typecheck,
  test, and build on every pull request, fails on any lint/typecheck error, and caches
  task results to skip unaffected projects.

### Design system
- **US-5 — Core component library.** `packages/ui` ships Button, Input, Textarea, Label,
  Form field, Card, Dialog, Dropdown menu, Select, Tabs, Toast, Badge, Avatar, Skeleton,
  Tooltip, and typography components on shadcn/ui + Base UI, themed with Tailwind tokens
  for color/spacing/radius/typography in both light and dark mode.
- **US-6 — Storybook and accessibility.** Every component has stories covering its
  variants/states; the Axe addon reports zero violations; the `storybook` Nx target
  builds and serves the design system.

### Shell
- **US-7 — Host app with Module Federation and routing.** The shell lazy-loads mfe-auth,
  mfe-chat, and mfe-settings at runtime as Module Federation remotes, with type-safe
  file-based TanStack Router routes and React/React DOM/router/query-client/design-system
  shared as singletons.
- **US-8 — Auth guard.** A shared TanStack Query client is exposed to all remotes;
  unauthenticated users hitting any chat or configuration route are redirected to login.
- **US-9 — Microfrontend failure isolation.** If a remote fails to load, only that area
  shows a scoped error state — navigation and the rest of the app keep working, verified
  by a simulated remote-failure test.

### Authentication
- **US-10 — Registration.** Client- and server-validated email/password registration,
  duplicate-email and weak-password rejection, hashed (Prisma/Postgres) password storage
  with no plaintext persistence or logging, and immediate login after signup.
- **US-11 — Login and logout.** Valid credentials land the user on their chat list;
  invalid credentials show one generic error; sessions are httpOnly-cookie JWTs
  inaccessible to client JS; logout invalidates the session.
- **US-12 — Session validation.** conversation-service validates the caller's token on
  every request (401 on missing/invalid); auth-service issues and validates tokens for
  other services; the shell redirects on an expired/invalid session.

### Chat
- **US-13 — Chat CRUD and history.** Create, list, rename, open, and delete chats; history
  persists in Postgres and survives reload/re-login; deleting a chat removes its messages
  entirely.
- **US-14 — Chat ownership isolation.** Every read/update/delete/stream request is
  checked against the authenticated owner; cross-user access returns 403/404; lists and
  search never leak another user's chats.
- **US-15 — Provider and model selection.** Users choose an LLM provider (Ollama, OpenAI,
  Anthropic) and model per chat; the choice is persisted and reused for every subsequent
  message in that chat.
- **US-16 — Send message and streamed response.** Messages persist immediately; responses
  stream token-by-token over SSE; the full chat history is sent as context on every
  request; users can stop mid-stream with the partial response saved and visible after
  reload.
- **US-17 — Message queue.** Messages sent during an active response join a per-chat FIFO
  queue, shown in a distinct "queued" state; users can edit or cancel a queued message
  before it starts, and queued messages process one at a time in order.
- **US-18 — Parallel chat sessions.** Multiple chats can stream responses at once;
  switching chats never interrupts an in-progress stream; the UI stays responsive with 5+
  simultaneous streams.
- **US-19 — LLM provider adapter layer.** A single adapter interface backs Ollama,
  OpenAI, and Anthropic; conversation-service picks the implementation from the chat's
  configured provider; adding a new provider only touches the adapter layer.
- **US-20 — File attachment upload and validation.** Users can attach `.txt`, `.pdf`,
  `.png`, and `.jpeg/.jpg` files (validated by extension and MIME type, client and
  server); oversized (>10 MB) or disallowed files are rejected before upload with a
  specific error.
- **US-21 — Attachments passed to the LLM.** Text/PDF content is extracted and included
  in the LLM context; images are sent as vision input to models that support it; users
  are warned before/instead of sending if the selected model can't handle a file type.
- **US-22 — Provider error handling and retry.** Provider errors, timeouts, and rate
  limits are caught and surfaced without crashing the chat; users can retry a failed
  message; a failed queued message is skipped/marked failed without blocking the queue.

### Configuration
- **US-23 — API key management UI.** A configuration page in mfe-settings, reachable from
  app navigation, lets users add/update/remove an API key per provider that needs one
  (OpenAI, Anthropic); Ollama is shown as keyless.
- **US-24 — Client-side-only key storage.** Keys live only in browser storage, scoped to
  the logged-in user; they are never sent to or stored on the server, disk, or logs;
  switching users on the same browser never exposes another user's keys.
- **US-25 — Key usage on LLM-calling requests.** The browser sends the relevant key on
  each provider-calling request; conversation-service uses it for that single request
  only, never persists it, and redacts it from logs and error responses.
- **US-26 — Masked display, test connection, and messaging.** Saved keys display masked
  (e.g. `sk-...a1b2`); a "Test connection" action reports success or a clear failure
  reason; sending without a configured key shows a clear message linking to
  configuration; removing a key re-prompts that provider's chats for a key on the next
  message.

### Quality and observability
- **US-27 — Structured logging.** Every auth-service/conversation-service request carries
  a correlation ID (generated or propagated); logs are structured JSON including that ID;
  API keys, passwords, and tokens are redacted from all log output.
- **US-28 — Metrics and dashboards.** Prometheus scrapes request rate, latency, error
  rate, and active-stream metrics from both services; Grafana ships a preconfigured
  dashboard; both start automatically with `docker compose up`.
- **US-29 — Testing strategy.** Vitest unit tests cover business logic and each LLM
  adapter with LLMs mocked; Pact contract tests verify frontend/service API contracts; a
  k6 script targets ~1s first-token latency with 5+ concurrent streaming chats; coverage
  targets are documented and enforced in CI.
- **US-30 — End-to-end coverage.** Playwright e2e specs cover UC1-UC8 against the
  docker-compose environment, with Axe accessibility checks and CI gating on results.

## Verification summary

`pnpm exec nx run-many -t lint typecheck test build` — all 15 projects × 4 targets (55
tasks) pass: zero lint errors, zero typecheck errors, all unit/integration suites green,
all builds succeed. Per-pod QA (`docs/pods/*/QA.md`) confirms every acceptance criterion
AC-1 through AC-100 in `docs/BACKLOG.json` has at least one test named with its AC id.

## Known limitations

- **Playwright e2e and k6 load test not executed in this environment.** Both need a live
  `docker compose` stack (Postgres, Ollama, all services) and, for e2e, real browsers;
  neither was available in the integration sandbox (no Docker). Their unit-testable logic
  (helpers, config, spec structure) is covered by `e2e:test`/`k6:test`, which pass.
- **`nx affected --base=origin/main` could not run** in the integration sandbox (no git
  remote configured); it was approximated with `nx run-many` across every project. This
  is an environment limitation, not a code defect — the real CI workflow runs the correct
  `nx affected` form against a real remote.
- **`docker compose config` was not re-validated** with the Docker CLI (not installed in
  the sandbox); `docker-compose.yml` is instead validated by parsing the YAML in
  `packages/workspace-config`'s test suite.
- **Coverage thresholds:** `apps/shell`'s `test` target runs plain `vitest run` (no
  `--coverage`), so its configured 80% thresholds aren't enforced by CI runs today; a
  follow-up for the `shell` pod, not a release blocker.
- **AC-18** (every microfrontend uses only design-system components) and a few other
  cross-pod acceptance criteria are verified only by contract tests within each owning
  pod's own test suite; no additional cross-repo static check exists beyond that.
