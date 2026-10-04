# Quality & Observability pod plan

Domain: Logging, metrics/dashboards, and the cross-cutting test suite (`docs/BACKLOG.json`
pod `quality-observability`, stories US-27..US-30). Context: `docs/ARCHITECTURE.md` §7
(cross-cutting concerns) and §8 (CI), `docs/STACK.md` decisions #6 (coverage), #8
(correlation header).

## Why this pod looks different from a domain pod

Unlike `auth`/`chat`/`settings`, this pod owns no `apps/*` or `services/*` directory of
its own. Its job is:
1. Ship **shared, reusable libraries** (logging, metrics, test config) that the
   service-owning pods (`auth`, `chat`) wire into their own request pipelines — the actual
   mounting of a correlation-id middleware or a `/metrics` route inside `auth-service` or
   `conversation-service` is done by those pods against this pod's contract, the same way
   every pod already consumes `packages/eslint-config`/`packages/tsconfig`.
2. Own the artifacts that don't belong inside any single domain: the Grafana dashboard
   JSON, the K6 load test, the Playwright E2E suite covering UC1-UC8, and the shared Pact
   scaffolding.
3. Document the testing strategy and coverage targets that every pod's own unit/contract
   tests (written inside their own `apps/*`/`services/*`) are expected to meet.

Where an acceptance criterion is only partially satisfied by this pod (because the rest
lives in a domain pod's own code), that split is called out explicitly in the "Covers"
line of the task and in the coverage table.

## Ownership (paths this pod writes/owns)

```
packages/observability/**        # NEW package: pino logger factory, redaction,
                                  # correlation-id middleware, prom-client metric helpers
packages/test-config/**          # NEW package: shared Vitest coverage-threshold preset
packages/pact-config/**          # NEW package: shared Pact config/helpers + provider-
                                  # verification convention
e2e/**                            # NEW Nx project: Playwright suite (UC1-UC8) + Axe checks
testing/k6/**                     # K6 load test script(s)
observability/grafana/provisioning/dashboards/**   # dashboard JSON + provider config
.github/workflows/e2e.yml         # NEW workflow: E2E job (separate file from platform's ci.yml)
docs/pods/quality-observability/**
```

`packages/*` is generally `platform-foundation`-owned per `docs/ARCHITECTURE.md` §2, and
`observability/**` (datasource provisioning, `prometheus.yml`) is also platform-owned.
Following the same carve-out already used for `packages/ui` (owned by `design-system`
even though it's under `packages/`), this pod proposes and owns the three new packages
above plus the `dashboards/` subfolder of the provisioning tree that
`platform-foundation`'s plan explicitly reserved for this pod ("this pod may add/replace
the dashboard JSON file itself under this same provisioning path"). Everything else under
`observability/` (datasource, `prometheus.yml`, folder scaffolding) and `docker-compose.yml`
stays platform-owned. All of this is flagged again under "Cross-pod dependencies" below
for the integration pass.

---

## O1 — Shared observability library: logging, correlation IDs, redaction

Files: `packages/observability/src/logging/{logger.ts, redaction.ts,
correlation-middleware.ts, index.ts}`, `package.json`, `project.json` (Nx targets: lint,
typecheck, test, build), `tsconfig.json`, `*.spec.ts`.

- `createLogger(serviceName)`: `pino` factory producing structured JSON logs with
  `service`, `level`, `time`, `msg`, and a `correlationId` field on every child logger
  created per request.
- `redaction.ts`: `pino` redaction paths (recursive) for `password`, `passwordHash`,
  `token`, `accessToken`, `refreshToken`, `apiKey`, `authorization`, `cookie` — case- and
  nesting-insensitive; exported as both a `pino` options fragment and a standalone
  `redact(obj)` helper for use in error responses.
- `correlationMiddleware()`: Express middleware reading the `X-Correlation-Id` header
  (constant imported from `packages/shared-types`, per `STACK.md` decision #8), generating
  a UUID if absent, attaching a child logger (`req.log`) with that ID to the request, and
  echoing the header back on the response.
- Unit tests (Vitest): correlation ID propagated when present, generated when absent,
  echoed on the response; redaction hides `password`/`token`/`apiKey` even when nested
  inside a larger object; log output is valid JSON with the required fields.

Covers: AC-88, AC-89, AC-90 as a reusable, unit-tested library and documented contract.
Wiring this middleware/logger into `auth-service`'s and `conversation-service`'s actual
request pipelines is each service-owning pod's task (see Cross-pod dependencies) — this
task's own acceptance is "library exists, is tested, and its contract is documented here."

---

## O2 — Shared metrics helpers

Files: `packages/observability/src/metrics/{registry.ts, http-metrics-middleware.ts,
active-stream-gauge.ts, index.ts}` + `*.spec.ts`.

- `registry.ts`: a `prom-client` `Registry` plus standard metrics: `http_requests_total`
  (Counter, labels `method`, `route`, `status`), `http_request_duration_seconds`
  (Histogram, same labels), `active_streams` (Gauge, labels `service`).
- `httpMetricsMiddleware()`: Express middleware that observes every request's duration and
  increments the request/error counters automatically.
- `active-stream-gauge.ts`: `incActiveStream()`/`decActiveStream()` helpers for
  `conversation-service`'s SSE handler to report concurrent streams.
- `metricsHandler()`: returns the `text/plain` Prometheus exposition body for mounting at
  `GET /metrics`.
- Unit tests: counters increment per request/status, histogram observes a duration,
  gauge increments/decrements correctly, `metricsHandler` outputs valid Prometheus text
  format.

Covers: AC-91 as a reusable, tested library. Mounting `/metrics` and calling the
active-stream gauge from the SSE handler is done inside `auth-service` and
`conversation-service` by the `auth` and `chat` pods, consuming this package (see
Cross-pod dependencies); `platform-foundation`'s `observability/prometheus.yml` (already
planned) scrapes those `/metrics` endpoints.

---

## O3 — Grafana dashboard

Files: `observability/grafana/provisioning/dashboards/dashboards.yml` (provider config
pointing Grafana at this folder), `observability/grafana/provisioning/dashboards/
platform-overview.json` (dashboard: request rate, p50/p95 latency, error rate, and active
streams panels, one row per service, built on the `http_requests_total`,
`http_request_duration_seconds`, and `active_streams` metrics from O2).

Covers: AC-92. (AC-93 — Prometheus/Grafana auto-starting via `docker compose up` — is
`platform-foundation`'s compose wiring, already planned in that pod's T3; this task only
supplies the dashboard content that makes AC-92 concretely true once both are merged.)

---

## O4 — Shared coverage/test config preset and testing-strategy documentation

Files: `packages/test-config/{vitest.preset.ts, coverage-thresholds.ts, index.ts}`,
`project.json`, `README.md`; a short "Testing strategy" section appended to this PLAN
(below).

- `coverage-thresholds.ts`: exports `{ lines: 80, statements: 80, functions: 80, branches:
  80 }` (per `STACK.md` decision #6).
- `vitest.preset.ts`: a `defineConfig` fragment (coverage provider `v8`, reporters,
  the thresholds above applied to `services/*` and `packages/ui`) that every project's own
  `vitest.config.ts` spreads/extends, the same pattern used for
  `packages/tsconfig`/`packages/eslint-config`.
- README documents: which projects must apply the thresholds (`services/*`,
  `packages/ui` per decision #6), how to opt a project's `test` target into failing on an
  unmet threshold, and the expectation (from `SPEC.md` §6 Testability and AC-94) that each
  pod's own Vitest suite covers its business logic and, for `conversation-service`
  specifically, each LLM provider adapter with the LLM mocked.

Covers: AC-97 (thresholds defined, documented, and consumed by every project's own `test`
target so `nx affected -t test` enforces them in CI). AC-94 is satisfied by each pod's own
unit tests (written inside `apps/*`/`services/*`, owned by that pod) against this shared
config; this task's job is the shared threshold definition/documentation, not authoring
other pods' unit tests.

---

## O5 — Shared Pact contract-testing scaffolding

Files: `packages/pact-config/{pact.config.ts, matchers.ts, index.ts}`, `project.json`,
`README.md`.

- `pact.config.ts`: shared Pact.js setup (pact dir `./pacts`, log level, consumer/provider
  naming convention `<mfe-name>` / `<service-name>`, `PACT_BROKER_URL`/
  `PACT_BROKER_TOKEN` env var names) so every pod's consumer tests and each service's
  provider-verification step configure Pact identically.
- `matchers.ts`: small re-exported helpers (`like`, `eachLike`, `term`) plus shared
  matchers for the common envelope shapes (error responses, correlation header) from
  `packages/shared-types`.
- README documents the convention: consumer contract tests live next to the feature that
  makes the call (e.g. `apps/mfe-auth/src/features/login/api/*.pact.spec.ts`), provider
  verification lives in the service's own test target (e.g. `services/auth-service`'s
  `test` or a dedicated `verify-contracts` Nx target) and is owned by that domain pod —
  matching what `auth`'s plan already assumes for its `mfe-auth` ↔ `auth-service` pact
  tests. Also documents an optional local Pact broker service (`pactfoundation/pact-broker`
  image) as a suggested addition to `docker-compose.yml`, proposed to `platform-foundation`
  as a PR rather than edited directly here.

Covers: AC-95 as shared scaffolding/convention. The consumer and provider contract test
files themselves are authored inside each domain pod's own `apps/mfe-*`/`services/*`
against this shared config, by that pod (`auth`, `chat`, `settings`).

---

## O6 — K6 performance test

Files: `testing/k6/streaming-load.ts`, `testing/k6/project.json` (Nx `perf` target running
`k6 run testing/k6/streaming-load.ts`), `testing/k6/README.md`.

- Scenario: spins up >=5 virtual users, each registering/logging in (or using seeded test
  users), creating a chat, sending a message, and consuming the SSE stream, recording a
  custom trend metric for time-to-first-token.
- Thresholds: `http_req_duration{stage:first_token}` p95 ~1s (NFR "first token within
  about 1 second"), 0% dropped/failed streams across 5 concurrent chats (FR7/UC6,
  AC-62/AC-96).
- README documents how to run it against a local `docker compose up` stack and how CI
  (or a manual/scheduled job, since it needs the full stack + Ollama) would invoke it.

Covers: AC-96.

---

## O7 — Playwright E2E suite covering UC1-UC8 + Axe checks

Files: new Nx project `e2e/` — `e2e/project.json` (Nx target `e2e` running Playwright),
`e2e/playwright.config.ts`, `e2e/package.json`, `e2e/tsconfig.json`,
`e2e/src/fixtures/{test-users.ts, wait-for-stack.ts}`,
`e2e/src/a11y/axe-helper.ts`, and one spec per use case:
`e2e/src/tests/{register.spec.ts, login.spec.ts, send-and-stream.spec.ts, queue.spec.ts,
attachments.spec.ts, parallel-sessions.spec.ts, isolation.spec.ts, api-keys.spec.ts}`.

- Each spec drives the app through the running `docker compose` stack (shell + all
  `mfe-*` + both services + Postgres + Ollama), exercising exactly one use case:
  - `register.spec.ts` — UC1 (incl. duplicate email / invalid password error paths).
  - `login.spec.ts` — UC2 (valid login lands on chat list; invalid shows generic error).
  - `send-and-stream.spec.ts` — UC3 (message streams incrementally, persists after reload,
    stop-mid-stream partial save).
  - `queue.spec.ts` — UC4 (two messages sent while streaming appear queued, processed in
    order; edit/cancel a queued message).
  - `attachments.spec.ts` — UC5 (valid file accepted and used; oversized/invalid type
    rejected client-side with a clear message).
  - `parallel-sessions.spec.ts` — UC6 (>=5 chats streaming concurrently, switching chats
    doesn't interrupt any stream).
  - `isolation.spec.ts` — UC7 (two authenticated browser contexts; user B's request for
    user A's chat ID returns 403/404 and isn't reachable in the UI).
  - `api-keys.spec.ts` — UC8 (enter/save a key, masked display, "Test connection" success
    and failure, removing a key re-prompts on next message).
- `axe-helper.ts` wraps `@axe-core/playwright`, run against the login page, the chat view,
  and the settings page in the relevant specs, asserting zero critical violations.
- `fixtures/wait-for-stack.ts` polls each service's `/health` before the suite starts.

Covers: AC-98 (all of UC1-UC8), AC-99 for the E2E half (the Storybook half of AC-99 is
`design-system`'s AC-20, already planned there).

---

## O8 — E2E CI wiring

Files: `.github/workflows/e2e.yml` (new workflow file, deliberately separate from
`platform-foundation`'s owned `.github/workflows/ci.yml` to avoid touching that pod's
path): checks out the repo, runs `docker compose up -d` (including the pre-pulled
`llama3.2:1b` Ollama model per `STACK.md` decision #7), waits on `wait-for-stack`, runs
`pnpm exec nx run e2e:e2e`, uploads the Playwright HTML report/trace as a build artifact
on failure, and runs `pnpm exec nx run test-config:...`-driven coverage checks are left to
the main `ci.yml`. Documents (in this PLAN and a comment in the workflow) that this job
should be marked as a required check for merges to satisfy AC-100; making it actually
required in branch protection is a repo-admin action outside any pod's file ownership,
flagged for the integration pass.

Covers: AC-100.

---

## Testing strategy & coverage targets (US-29 documentation, referenced by O4)

- **Unit tests (Vitest)**: every `services/*` project and `packages/ui` enforce the 80%
  line/statement/function/branch thresholds from O4's `packages/test-config` preset.
  `conversation-service`'s LLM adapter tests (owned by `chat`) must mock the LLM/HTTP
  calls for Ollama, OpenAI, and Anthropic — no live network calls in unit tests.
- **Contract tests (Pact)**: one consumer suite per `mfe-*` against the service(s) it
  calls, verified by that service's provider-verification step, both using O5's shared
  config; owned and authored by the domain pod on each side of the contract.
- **Performance (K6)**: O6's script is the single source of truth for the ~1s
  first-token and 5-concurrent-stream NFRs; run manually/on a schedule against a local or
  CI-provisioned `docker compose` stack (full-stack + Ollama needed, so it is not part of
  the fast per-PR `nx affected` loop).
- **End-to-end (Playwright)**: O7's suite is the single source of truth for UC1-UC8 and
  runs against the full `docker compose` stack via O8's CI job.
- **Accessibility (Axe)**: enforced in two places — Storybook stories (`design-system`
  pod, AC-19/20) and O7's E2E specs on the login/chat/settings pages (AC-99).

## Acceptance criteria coverage map

| AC | Task |
|----|------|
| AC-88 | O1 (library + contract; wired into `auth-service`/`conversation-service` by `auth`/`chat`) |
| AC-89 | O1 |
| AC-90 | O1 |
| AC-91 | O2 (library + contract; `/metrics` mounted by `auth`/`chat`; scraped per `platform-foundation`'s `prometheus.yml`) |
| AC-92 | O3 |
| AC-93 | platform-foundation (compose wiring; not this pod) |
| AC-94 | O4 (shared config/docs; unit tests themselves authored by `auth`/`chat`/`design-system` in their own projects) |
| AC-95 | O5 (shared scaffolding/convention; consumer/provider tests authored by `auth`/`chat`/`settings`) |
| AC-96 | O6 |
| AC-97 | O4 |
| AC-98 | O7 |
| AC-99 | O7 (E2E half) + design-system (Storybook half, already planned) |
| AC-100 | O8 |

## Cross-pod dependencies

- `platform-foundation`: owns `packages/shared-types` (this pod consumes the
  `CORRELATION_HEADER` constant and DTO/error shapes in O1/O2/O5), `docker-compose.yml`
  and `observability/prometheus.yml`/datasource provisioning (this pod only adds
  `observability/grafana/provisioning/dashboards/**`), and `.github/workflows/ci.yml`
  (this pod adds a separate `e2e.yml` rather than editing it). The optional Pact broker
  compose service proposed in O5 is a suggested PR to `platform-foundation`, not a direct
  edit.
- `auth` pod: must mount O1's correlation middleware/logger and O2's metrics
  middleware/`/metrics` route inside `services/auth-service`'s bootstrap (its own PLAN.md
  B1 already scaffolds an equivalent local logger/metrics setup — reconcile at
  integration time so both pods converge on `packages/observability` rather than two
  diverging implementations), and to author its own Pact consumer/provider tests against
  O5's config.
- `chat` pod: same as `auth` for `services/conversation-service`, plus calling O2's
  active-stream gauge from the SSE handler and mocking LLM providers in its own adapter
  unit tests per O4.
- `design-system` pod: owns the Storybook half of AC-99 (already planned); O7 only covers
  the E2E half.
- `settings` pod: authors its own Pact consumer tests (`mfe-settings` ↔
  `conversation-service`) against O5's config, and is exercised by O7's `api-keys.spec.ts`.

## Known gaps / open items for integration

- `packages/observability`, `packages/test-config`, and `packages/pact-config` are new
  packages proposed by this pod; `platform-foundation`'s `nx.json` tag scheme
  (`type:package`, `scope:shared`) needs these three added during integration if that
  pod's plan didn't anticipate them.
- Actual adoption of O1/O2 inside `auth-service`/`conversation-service` (replacing any
  pod-local logger/metrics code those pods scaffold independently) is a Tech-Lead
  integration task, not guaranteed to be done by either domain pod's own build step.
- Making the `e2e.yml` job a required status check is a repo-admin action outside pod file
  ownership; flagged here for whoever configures branch protection.
