# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-25

### Added

First release of the LLM chat application, an Nx/pnpm monorepo assembled from 7 pods:

- **Monorepo & CI** (`platform-foundation`): Nx + pnpm workspaces (`apps/`, `services/`,
  `packages/`) with lint/typecheck/test/build targets and module-boundary enforcement on
  every project; CI running `nx affected` for lint/typecheck/test/build with task
  caching; a `docker compose up` that starts the shell, mfe-auth, mfe-chat, mfe-settings,
  auth-service, conversation-service, Postgres, Ollama, Prometheus, and Grafana, plus an
  `.env.example` covering every service's environment variables.
- **Design system** (`packages/ui`): 15+ components (Button, Input, Textarea, Label, Form
  field, Card, Dialog, Dropdown menu, Select, Tabs, Toast, Badge, Avatar, Skeleton,
  Tooltip) and a typography scale built on shadcn/ui + Base UI, themed with Tailwind
  design tokens supporting light and dark mode, documented in Storybook with the
  accessibility (Axe) addon reporting zero violations.
- **Shell** (`apps/shell`): Vite Module Federation host lazy-loading mfe-auth, mfe-chat,
  and mfe-settings as remotes; type-safe file-based TanStack Router routes; a shared
  TanStack Query client and React/React DOM/router/design-system singletons across host
  and remotes; an auth guard redirecting unauthenticated users to login; per-remote error
  boundaries isolating a failing microfrontend from the rest of the app.
- **Authentication** (`apps/mfe-auth`, `services/auth-service`): registration with
  client/server validation, duplicate-email and password-policy rejection, hashed
  password storage via Prisma/Postgres; login/logout with httpOnly-cookie JWT sessions
  and a single generic invalid-credentials message; session validation on every
  protected request across services, with the shell redirecting on expired/invalid
  sessions.
- **Chat** (`apps/mfe-chat`, `services/conversation-service`): chat create/list/rename/
  open/delete with persisted history restored across reloads; strict per-user ownership
  checks (403/404 on cross-user access, no cross-user leakage in lists/search);
  per-chat provider/model selection persisted and reused for subsequent messages;
  SSE token-by-token streaming with full conversation history sent as context, mid-stream
  stop with partial-response persistence; a FIFO per-chat message queue with a queued UI
  state, edit/cancel before processing, and skip-on-failure without blocking the rest of
  the queue; concurrent multi-chat streaming (5+ chats) without interrupting other
  streams; a common adapter interface for Ollama, OpenAI, and Anthropic selected per
  chat; file attachments (.txt, .pdf, .png, .jpeg/.jpg, ≤10 MB) validated on client and
  server, with text/PDF extraction and image vision input, clear errors for unsupported
  files/models, and provider error/timeout/rate-limit handling with user-facing retry.
- **Configuration** (`apps/mfe-settings`): a settings page reachable from app navigation
  for adding, updating, and removing OpenAI/Anthropic API keys (Ollama shown as keyless);
  keys stored only in browser storage scoped to the logged-in user, never sent to or
  persisted by the server, and not leaked between users on the same browser; keys sent
  per-request to conversation-service, used only for that request, never persisted, and
  redacted from logs/errors; masked key display, a "Test connection" action, a clear
  missing-key message linking to configuration, and a reprompt for chats after a key is
  removed.
- **Quality & observability**: structured JSON logging with correlation IDs and
  redaction of secrets on auth-service and conversation-service; Prometheus metrics
  (request rate, latency, error rate, active streams) with a preconfigured Grafana
  dashboard, both started by `docker compose up`; Vitest unit tests (including mocked
  LLM adapters) with documented, CI-enforced coverage thresholds; Pact contract tests
  between frontends and services; a k6 script validating ~1s first-token latency under
  5+ concurrent streaming chats; Playwright e2e specs covering UC1-UC8 with Axe
  accessibility checks, structured to gate CI.

### Known limitations

Carried over from `docs/RELEASE.md` and per-pod QA reports:

- Playwright e2e (`e2e:e2e`) and the k6 load test (`k6:perf`) require a live
  `docker compose` stack (Postgres, Ollama, all services) and real browsers; they were
  not executed in the integration sandbox (no Docker available). Their unit-testable
  logic (helpers, config, spec structure) is covered and passes via `e2e:test`/`k6:test`.
- `nx affected --base=origin/main` could not be run in the integration sandbox (no git
  remote configured); it was approximated with `nx run-many -t lint typecheck test build`
  across all 15 projects, which passed in full. The real CI workflow uses the correct
  `nx affected` form against a real remote.
- `docker compose config` was not re-validated with the Docker CLI (not installed in the
  sandbox); `docker-compose.yml` is instead validated by parsing the YAML in
  `packages/workspace-config`'s test suite.
- `apps/shell`'s `test` target runs `vitest run` without `--coverage`, so its configured
  80% coverage thresholds are not enforced by CI runs today; flagged as a follow-up for
  the `shell` pod rather than a release blocker.
- AC-18 (every microfrontend uses only design-system components) and a few other
  cross-pod acceptance criteria are verified only by contract tests within each owning
  pod, per their `PLAN.md`s; no additional cross-repo static check was added beyond each
  pod's own QA coverage.
