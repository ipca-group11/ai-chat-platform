# Test Types: AI Chat Platform

Test types for this project, grouped by layer. **Status:**
- ✅ already in the repo
- 🟡 partly there
- ⬜ not started

Items marked **★** cover risks specific to this architecture: multi-user data, LLM streaming and micro-frontends.

**Owner** is who agreed to deliver the test type. **—** means nobody owns it yet (see [Not assigned](#not-assigned)).

## Frontend

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| ✅ | Unit testing | JP | Hooks, utils, model capability tables | Vitest |
| ✅ | Component testing | JP | React components in isolation (Composer, ChatView, ProviderList) | Vitest + Testing Library |
| ⬜ | Host / Remote contract testing ★ | — | The shell and the remotes agree on exposed modules (`mfeChat/routes`, …) and their props | Vitest, type checks on `@mf-types` |
| ⬜ | Composition testing ★ | — | The shell loads all three remotes together, with routing and auth working | Playwright |
| ⬜ | Version skew testing ★ | — | A new shell works with old remotes, and old with new (independent deploys) | Playwright + pinned remote images |
| ⬜ | Remote failure and fallback testing ★ | João Vieira | One remote is down or slow → error boundary/fallback shown, the rest of the app still works | Playwright route blocking |
| ⬜ | Shared dependency testing ★ | — | Only one React / React Query instance at runtime (otherwise hooks break) | Playwright + runtime assertion |
| ⬜ | Streaming UI testing ★ | — | Tokens render as they arrive; stop and retry work; partial answers are kept | Vitest (mock SSE) + Playwright |
| ⬜ | SSE reconnection testing | João Vieira | A network drop during streaming leads to a resume or a clear error | Playwright network emulation |
| ⬜ | Session expiry testing | — | The access token expires mid-chat or mid-stream and is refreshed or the user is sent to login | Playwright |
| ⬜ | Visual regression testing | JP | Pixel differences of key screens in light and dark themes | Playwright `toHaveScreenshot` |
| 🟡 | Snapshot testing | JP | Only small, stable outputs (serialized DTOs), not large component trees | Vitest |
| ✅ | Accessibility testing | João Vieira | WCAG checks on every page | axe-core (`@axe-core/playwright`) |
| ⬜ | Performance testing | JP | LCP / INP / CLS budgets per page | Lighthouse CI; Grafana Faro for real-user data |
| ⬜ | Bundle size budget testing | JP | Each remote's `remoteEntry.js` and chunks stay under a size limit | size-limit |
| ⬜ | Cross-browser testing | — | Chromium, Firefox, WebKit | Playwright projects |
| ⬜ | Responsive / mobile testing | — | Layout at phone and tablet widths | Playwright viewports |
| 🟡 | E2E testing | João Delgado | Register → login → chat → settings, against the full stack | Playwright (chat specs need `ANTHROPIC_API_KEY`) |

## Backend

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| ✅ | Unit testing | — | Services, schemas, error mapping | Vitest |
| ✅ | Integration testing | JP | HTTP routes with Express + fake repositories | Vitest + supertest |
| ⬜ | Component testing | — | One service in isolation with a real Postgres and a fake LLM provider | Vitest + Testcontainers |
| 🟡 | Consumer-driven contract testing | João Vieira | REST contract between the MFEs (consumers) and the services (providers) | Pact (`packages/pact-config`) |
| ⬜ | SSE event contract testing ★ | — | Stream event types, order and end-of-stream between conversation-service and mfe-chat (replaces "message contract testing", since there is no broker) | Pact message pacts or Zod schema tests |
| ⬜ | API schema validation testing | João Vieira | Requests and responses match the shared Zod/OpenAPI schemas | Zod, Schemathesis |
| ⬜ | Authentication testing | — | Expired, tampered and wrong-algorithm JWTs; refresh token rotation and reuse; logout | Vitest + supertest |
| ⬜ | Authorization / IDOR testing ★ | — | User A cannot read, stream, retry or delete user B's chats, messages or attachments | Vitest + supertest, Playwright |
| ⬜ | File upload testing | — | Size limit, spoofed MIME type, path traversal in filenames, malicious PDFs | Vitest + supertest |
| ⬜ | Concurrency testing | João Vieira | Two messages sent to the same chat at once; retry while a stream is running | Vitest, k6 |
| ⬜ | Property-based / fuzz testing | — | Random input to validation schemas and parsers | fast-check |
| ⬜ | Database migration testing | — | Migrations apply on a database with existing data, and roll back. **Blocked:** services use `prisma db push`; switch to `prisma migrate` first | Prisma Migrate + Testcontainers |
| 🟡 | Observability testing | — | Metrics and logs exist with the expected labels (the dashboard was empty because nothing checked this) | Vitest (`/metrics` assertions) |
| ⬜ | Health / readiness testing | — | `/health` reports unhealthy when Postgres is down | Vitest, Docker |
| ⬜ | Chaos testing | João Vieira | Kill Postgres, slow down the LLM provider, drop the network → graceful degradation | Docker stop / toxiproxy |
| ⬜ | Performance testing | — | p95 latency per route stays under budget | k6 + Prometheus |
| 🟡 | Load testing | JP | Concurrent users and streams on the 4 GB VM until it saturates | k6 (`testing/k6`) |
| 🟡 | E2E testing | João Delgado | Full user flows through the real backend | Playwright |

## LLM layer

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| ⬜ | Provider adapter testing with recorded responses ★ | JP | Replay recorded Anthropic/OpenAI streams: text, thinking, `pause_turn`, `max_tokens`, errors | Vitest + recorded SSE fixtures |
| ⬜ | Error mapping testing ★ | — | 401 bad key, 429 rate limit, 529 overloaded, timeouts → correct user message and failed message state | Vitest |
| ⬜ | Model capability testing | — | Each listed model gets valid params (thinking style, web-fetch tool version, vision) | Vitest table tests |
| ⬜ | Stream cancellation testing | João Vieira | Stopping or leaving mid-answer aborts the upstream request (no tokens paid for nothing) | Vitest + mock server |
| ⬜ | Output evaluation (evals) | — | Fixed prompt set scored by exact match, regex or LLM-as-judge; catches quality regressions | promptfoo or a custom script |
| ⬜ | Token budget and cost testing | — | `max_tokens`, context truncation and the cost of a typical conversation stay within limits | Vitest + usage fields |
| ⬜ | Rate limiting testing | — | The app's own limits plus the provider's 429 handling and retry/backoff | Vitest, k6 |
| ⬜ | API key handling testing ★ | — | `X-Llm-Api-Key` never appears in logs, metrics, the database or error responses | Vitest (log capture) |
| — | RAG retrieval testing | — | **Not applicable:** the app has no RAG. Add it only if retrieval is implemented | — |

## Security

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| ⬜ | Prompt injection testing | JP | Malicious text in uploaded files or web-fetched pages can't change the system behaviour | promptfoo red-team, garak |
| ⬜ | SAST | JP | Static code analysis for vulnerabilities | CodeQL, Semgrep |
| ⬜ | DAST | JP | Scan of the running app (OWASP Top 10) | OWASP ZAP baseline in CI |
| ⬜ | Penetration testing | JP | Manual, time-boxed attack of the deployed app (a scheduled activity, not a CI test) | Manual + ZAP / Burp |
| ⬜ | Dependency vulnerability scanning (SCA) | João Delgado | Known CVEs in npm packages | `pnpm audit`, Dependabot |
| ⬜ | Container image scanning | João Delgado | CVEs in the GHCR images before deploy | Trivy |
| ⬜ | SBOM generation | JP | Dependency list per image; an artifact that SCA checks, not a test by itself | Syft, `docker buildx --sbom` |
| ⬜ | Secret scanning | JP | No keys or passwords committed | gitleaks, GitHub secret scanning |
| ⬜ | Security header / TLS testing | — | CSP, HSTS, cookie flags (`Secure`, `HttpOnly`, `SameSite`), CORS allow-list | ZAP, curl assertions |
| ⬜ | Brute-force / auth rate limit testing | — | `/auth/login` and `/auth/register` throttle repeated attempts | k6, supertest |
| ⬜ | PII masking testing | JP | Emails, IPs and message content are masked in logs, metrics and Faro telemetry | Vitest (log capture) |
| ⬜ | GDPR retention and deletion testing | JP | Deleting a user removes their chats, messages, files and telemetry; retention periods enforced | Vitest + Testcontainers |

## Delivery and operations

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| 🟡 | Post-deploy smoke testing | — | After deploy: site, login, chats load (the deploy only curls `/` today) | GitHub Actions + curl / Playwright |
| ⬜ | Rollback testing | — | Redeploy an older commit; the app still works with the newer database | GitHub Actions `workflow_dispatch` |
| ⬜ | Backup and restore testing | — | Restore a Postgres dump into a fresh container and verify the data | `pg_dump` / `pg_restore` |
| ⬜ | Synthetic monitoring | — | Scheduled login → chat check against production | Grafana synthetic checks, scheduled Playwright |
| 🟡 | Infrastructure config testing | — | `docker compose config`, `caddy validate`, `actionlint`, Loki `-verify-config` | CI |

## Test quality

| Status | Test type | Owner | What it checks here | Tooling |
|---|---|---|---|---|
| 🟡 | Coverage thresholds | JP | Minimum line/branch coverage per project | Vitest coverage |
| ⬜ | Mutation testing | João Vieira | Whether the tests actually catch injected bugs (coverage can't tell you this) | Stryker |
| ⬜ | Flaky test detection | — | Re-run failures and track tests that fail at random | Playwright retries, Nx |

## Not assigned

These test types are in the tables but have no owner. Either assign them or mark them out of scope.

- **Frontend:** Host / Remote contract testing, Composition testing, Version skew testing, Shared dependency testing, Streaming UI testing, Session expiry testing, Cross-browser testing, Responsive / mobile testing
- **Backend:** Unit testing, Component testing, SSE event contract testing, Authentication testing, Authorization / IDOR testing, File upload testing, Property-based / fuzz testing, Database migration testing, Observability testing, Health / readiness testing, Performance testing
- **LLM layer:** Error mapping testing, Model capability testing, Output evaluation (evals), Token budget and cost testing, Rate limiting testing, API key handling testing
- **Security:** Security header / TLS testing, Brute-force / auth rate limit testing
- **Delivery and operations:** Post-deploy smoke testing, Rollback testing, Backup and restore testing, Synthetic monitoring, Infrastructure config testing
- **Test quality:** Flaky test detection

Suggested priorities 1, 3 and 4 below (Authorization / IDOR, SSE event contract, database migrations) have no owner, and neither does composition testing from priority 5.

## Suggested priority

1. **Authorization / IDOR testing:** the most likely real bug in a multi-user app.
2. **Provider adapter testing with recorded responses:** covers the core LLM streaming path without API cost.
3. **SSE event contract testing:** the critical link between conversation-service and mfe-chat.
4. **Database migrations:** switch to `prisma migrate`, then test them.
5. **Remote failure and fallback** and **composition testing:** the main risks of the micro-frontend design.
