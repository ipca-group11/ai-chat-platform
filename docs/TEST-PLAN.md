# Test Plan: AI Chat Platform

Each test type is one epic in Jira ([AICHAT board](https://ipca-grupo11.atlassian.net/jira/software/projects/AICHAT/boards/)). Source and unowned types: [TEST-TYPES.md](TEST-TYPES.md).
**★** architecture-specific risk.

## Shared DoR / DoD (applies to every epic)

**DoR**

- Owner assigned, scope and tooling agreed
- Target environment available (local, CI or VM)

**DoD**

- Tests run in CI (or a scheduled job / documented manual run where stated) and pass on `main`
- Failure blocks the merge or deploy, unless stated otherwise
- Run instructions added to the project README or `docs/`

Below, each epic lists only what it adds to these.

## Summary

| Owner        | Epics  |
| ------------ | ------ |
| João Delgado | 4      |
| João Vieira  | 9      |
| JP           | 18     |
| **Total**    | **31** |

## João Delgado

### AICHAT-4 · [Foundations] E2E testing, frontend flows

- **DoR:** full stack runs via `compose.yaml`; test user seeding defined
- **DoD:** register → login → chat → settings specs in `e2e/`; chat specs skip cleanly without `ANTHROPIC_API_KEY`; runs in `e2e.yml`

### AICHAT-5 · [Foundations] E2E testing, backend flows

- **DoR:** AICHAT-4 harness in place
- **DoD:** each user flow asserts the backend state (chat and messages persisted); runs in `e2e.yml`

### AICHAT-6 · [Foundations] Dependency vulnerability scanning (SCA)

- **DoR:** severity threshold agreed (e.g. high+)
- **DoD:** `pnpm audit` in `ci.yml` fails on the threshold; Dependabot enabled; existing findings fixed or waived with a reason

### AICHAT-7 · [Foundations] Container image scanning

- **DoR:** image list and severity threshold agreed
- **DoD:** Trivy scans every GHCR image in `deploy.yml` before push; high+ CVEs block the deploy; report kept as a CI artifact

## João Vieira

### AICHAT-8 · [Foundations] Remote failure and fallback testing ★

- **DoR:** error boundary / fallback UI exists in the shell for each remote
- **DoD:** Playwright blocks and delays each of the 3 remotes in turn; fallback shown and the other routes still work

### AICHAT-9 · [Foundations] SSE reconnection testing

- **DoR:** expected behaviour decided (resume or clear error)
- **DoD:** network drop mid-stream tested; the UI resumes or shows the error and never hangs

### AICHAT-10 · [Foundations] Accessibility testing

- **DoR:** pages and themes to check listed; `@axe-core/playwright` installed
- **DoD:** axe-core runs on every page, light and dark; zero serious/critical violations

### AICHAT-11 · [Foundations] Consumer-driven contract testing

- **DoR:** `packages/pact-config` set up; consumer/provider pairs listed
- **DoD:** every MFE → service REST call has a pact; provider verification runs in CI

### AICHAT-12 · [Foundations] API schema validation testing

- **DoR:** shared Zod schemas in `packages/shared-types` cover every route
- **DoD:** request and response of every route validated against the schemas; Schemathesis run against the OpenAPI spec

### AICHAT-13 · [Foundations] Concurrency testing

- **DoR:** expected result defined (reject, queue or order)
- **DoD:** two simultaneous sends and retry-during-stream tested; no duplicate or lost messages

### AICHAT-14 · [Foundations] Chaos testing

- **DoR:** toxiproxy or Docker scripts available; expected degradation per fault defined
- **DoD:** Postgres down, slow LLM and network drop each tested; clear errors, no crash, recovery after the fault ends; scheduled job, not a merge gate

### AICHAT-15 · [Foundations] Stream cancellation testing

- **DoR:** mock LLM server that records connection close
- **DoD:** stop button and navigating away both abort the upstream request; the message is marked as stopped

### AICHAT-16 · [Foundations] Mutation testing

- **DoR:** AICHAT-34 coverage thresholds in place; target projects chosen
- **DoD:** Stryker runs on the chosen projects; mutation score threshold set; scheduled job, not a merge gate

## JP

### AICHAT-17 · [Foundations] Unit testing

- **DoR:** hooks, utils and capability tables to cover listed
- **DoD:** hooks, utils and model capability tables covered; meets AICHAT-34 thresholds

### AICHAT-18 · [Foundations] Component testing

- **DoR:** Testing Library set up; states to cover listed per component
- **DoD:** Composer, ChatView and ProviderList tested for render, interaction and error states

### AICHAT-19 · [Foundations] Visual regression testing

- **DoR:** key screens listed; fixed fonts and data for stable rendering
- **DoD:** baselines for each screen in light and dark; `toHaveScreenshot` diffs fail CI

### AICHAT-20 · [Foundations] Snapshot testing

- **DoR:** DTOs to snapshot listed
- **DoD:** serialized DTOs and wire output snapshotted; every UI component has a story whose DOM is snapshotted (owner decision of 2026-10-04, replacing "no component-tree snapshots")

### AICHAT-21 · [Foundations] Performance testing (frontend)

- **DoR:** LCP / INP / CLS budgets agreed per page
- **DoD:** Lighthouse CI checks every page against the budgets; Faro real-user vitals visible in Grafana

### AICHAT-22 · [Foundations] Bundle size budget testing

- **DoR:** size limits agreed per remote
- **DoD:** size-limit checks every `remoteEntry.js` and chunk; going over fails CI

### AICHAT-23 · [Foundations] Integration testing

- **DoR:** fake repositories available for each service
- **DoD:** every Express route tested with supertest and fake repositories, including error paths

### AICHAT-24 · [Foundations] Load testing

- **DoR:** `testing/k6` scenarios for users and streams; mock LLM so it costs nothing
- **DoD:** saturation point on the 4 GB VM found and written down (users, streams, p95, memory); manual run

### AICHAT-25 · [Foundations] Provider adapter testing with recorded responses ★

- **DoR:** recorded Anthropic and OpenAI SSE fixtures
- **DoD:** replay covers text, thinking, `pause_turn`, `max_tokens` and errors per provider; no network calls

### AICHAT-26 · [Foundations] Prompt injection testing

- **DoR:** attack set defined for uploaded files and web-fetched pages
- **DoD:** promptfoo red-team runs the set; no system-prompt leak or tool misuse; scheduled job, not a merge gate

### AICHAT-27 · [Foundations] SAST

- **DoR:** tool chosen (CodeQL or Semgrep)
- **DoD:** runs on every PR; high findings block the merge; existing findings fixed or waived

### AICHAT-28 · [Foundations] DAST

- **DoR:** a running stack reachable from CI
- **DoD:** ZAP baseline runs against it; high alerts fail; false positives listed in a rules file

### AICHAT-29 · [Foundations] Penetration testing

- **DoR:** time box, scope and rules of engagement written
- **DoD:** report with findings and severity in `docs/`; high findings fixed or ticketed

### AICHAT-30 · [Foundations] SBOM generation

- **DoR:** AICHAT-7 image list
- **DoD:** SBOM generated for every image at build and attached as an artifact; used by AICHAT-6/04

### AICHAT-31 · [Foundations] Secret scanning

- **DoR:** gitleaks config with allow-list for test fixtures
- **DoD:** gitleaks on every PR plus full history scanned once; GitHub secret scanning on; any leaked secret rotated

### AICHAT-32 · [Foundations] PII masking testing

- **DoR:** PII fields listed (email, IP, message content); masking rule defined
- **DoD:** log, `/metrics` and Faro payloads captured in tests; no raw PII found

### AICHAT-33 · [Foundations] GDPR retention and deletion testing

- **DoR:** retention periods defined; user deletion endpoint exists
- **DoD:** deleting a user removes chats, messages, files and telemetry (checked with Testcontainers); retention job tested

### AICHAT-34 · [Foundations] Coverage thresholds

- **DoR:** line/branch minimum agreed per project
- **DoD:** Vitest coverage thresholds set in every project; going below fails CI
