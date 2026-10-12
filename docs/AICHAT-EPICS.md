---
title: "JP's testing epics: discovery index"
---

# JP's testing epics: discovery index

Discovery of the 19 Jira epics assigned to JP in [AICHAT](https://ipca-grupo11.atlassian.net/jira/software/projects/AICHAT/list)
(AICHAT-17 to AICHAT-34 and AICHAT-144, label `testing`, all **TODO** on 2026-10-03, no child issues yet).
Each epic has its own folder `docs/AICHAT-<id>/README.md` with the same sections:

1. Goal · 2. DoR/DoD (from Jira) · 3. Technologies · 4. Discovery: current state (with file references) ·
5–6. Plan / steps · User stories (with acceptance criteria and story points) · Risks and open decisions · **Notes for the report**

This is **discovery only**: no application code was changed. Source documents: [TEST-PLAN.md](TEST-PLAN.md), [TEST-TYPES.md](TEST-TYPES.md).

## Overview

| Epic | Title | Layer | Main tools | Stories | Points | Blocked by |
|---|---|---|---|---|---|---|
| [AICHAT-17](AICHAT-17/README.md) | Unit testing | **By MFE and microservice**: shell, mfe-auth, mfe-chat, mfe-settings, auth-service, conversation-service (+ packages) | Vitest, Testing Library (`render`/`renderHook`), supertest, ESLint `RuleTester`, MSW (optional) | 14 | 47 | exempt list agreed |
| [AICHAT-18](AICHAT-18/README.md) | Component testing | Frontend | Vitest, Testing Library, user-event, fake EventSource | 5 | 14 | — |
| [AICHAT-19](AICHAT-19/README.md) | Visual regression testing | Frontend | Playwright `toHaveScreenshot`, Playwright Docker image | 5 | 12 | AICHAT-4 harness; font hosting decision |
| [AICHAT-20](AICHAT-20/README.md) | Snapshot testing | Shared types | Vitest snapshots, Zod, `vitest/no-large-snapshots` | 5 | 11 | — |
| [AICHAT-21](AICHAT-21/README.md) | Performance testing (frontend) | Frontend | Lighthouse CI, Grafana Faro, Loki, Grafana | 5 | 11 | budgets agreed |
| [AICHAT-22](AICHAT-22/README.md) | Bundle size budget testing | Frontend build | size-limit (`@size-limit/file`), Nx target | 5 | 10 | limits agreed |
| [AICHAT-23](AICHAT-23/README.md) | Integration testing | Backend | Vitest, supertest, in-memory fakes | 8 | 19 | `createApp` DI (agree with owners) |
| [AICHAT-24](AICHAT-24/README.md) | Load testing | Backend / infra | k6 (+ xk6-sse), Prometheus/Grafana, `docker stats` | 4 | 11 | AICHAT-144 (mock server) |
| [AICHAT-25](AICHAT-25/README.md) | Provider adapter testing with recorded responses ★ | LLM | Vitest, recorded SSE fixtures, `fetchImpl` replay, no-network guard | 5 | 13 | API keys for one recording run |
| [AICHAT-26](AICHAT-26/README.md) | Prompt injection testing | LLM / security | promptfoo red-team (HTTP provider), garak (optional) | 5 | 15 | system-prompt decision; API budget |
| [AICHAT-27](AICHAT-27/README.md) | SAST | Security | **Semgrep CE** (CodeQL needs GHAS on a private repo) | 5 | 10 | — |
| [AICHAT-28](AICHAT-28/README.md) | DAST | Security | OWASP ZAP baseline, `rules.tsv`, AJAX spider | 5 | 11 | — (reuses the e2e stack) |
| [AICHAT-29](AICHAT-29/README.md) | Penetration testing | Security | OWASP WSTG/ASVS, Burp/ZAP, jwt_tool, ffuf, testssl.sh, CVSS | 6 | 18 | rules of engagement approved |
| [AICHAT-30](AICHAT-30/README.md) | SBOM generation | Supply chain | Syft (`anchore/sbom-action`), BuildKit SBOM/provenance, CycloneDX/SPDX | 5 | 8 | interface with AICHAT-6/7 |
| [AICHAT-31](AICHAT-31/README.md) | Secret scanning | Security | gitleaks (CLI/Docker), GitHub secret scanning (paid on private) | 6 | 10 | — |
| [AICHAT-32](AICHAT-32/README.md) | PII masking testing | Privacy | pino redact, log/metrics capture, Faro `beforeSend`, Playwright | 6 | 14 | masking rule agreed |
| [AICHAT-33](AICHAT-33/README.md) | GDPR retention and deletion testing | Privacy | Testcontainers (Postgres), Prisma, Loki retention | 7 | 24 | **user deletion endpoint missing** |
| [AICHAT-34](AICHAT-34/README.md) | Coverage thresholds | Test quality | Vitest coverage-v8, `@platform/test-config` | 6 | 11 | — |
| [AICHAT-144](AICHAT-144/README.md) | Mock server | Test infrastructure: LLM providers, auth/conversation APIs, MFE remotes, telemetry | Node + Express, SSE, `@platform/shared-types` schemas, compose profiles | 18 | 51 | env-configurable LLM base URL (small app change) |
| | **Total** | | | **125** | **320** | |

All stories were created in Jira on 2026-10-03 as children of their epic, assigned to JP, label `testing`. Each story has its own Jira key (listed in the **Jira** column of every epic README); `AICHAT-<epic>-US<n>` is only the reference inside the analysis docs. The way each epic is worked is described in [EPIC-WORKFLOW.md](EPIC-WORKFLOW.md).

## Delivery status

| Epic | Status | Work log | Pull requests |
|---|---|---|---|
| AICHAT-34 | Review (merged into the integration branch) | [WORKLOG](AICHAT-34/WORKLOG.md) | #4 |
| AICHAT-31 | Review (merged into the integration branch) | [WORKLOG](AICHAT-31/WORKLOG.md) | #7 |
| AICHAT-27 | Review (merged into the integration branch) | [WORKLOG](AICHAT-27/WORKLOG.md) | #9 |
| AICHAT-25 | Review (merged into the integration branch) | [WORKLOG](AICHAT-25/WORKLOG.md) | #11 |
| AICHAT-144 | Review (merged into the integration branch) | [WORKLOG](AICHAT-144/WORKLOG.md) | #12 |
| AICHAT-17 | Done (merged into the integration branch) | [WORKLOG](AICHAT-17/WORKLOG.md) | #13 |
| AICHAT-18 | Done (merged into the integration branch) | [WORKLOG](AICHAT-18/WORKLOG.md) | #14 |
| AICHAT-23 | Done (merged into the integration branch) | [WORKLOG](AICHAT-23/WORKLOG.md) | #15 |
| AICHAT-20 | Done (merged into the integration branch) | [WORKLOG](AICHAT-20/WORKLOG.md) | #16 |
| AICHAT-24 | Done (merged into the integration branch) | [WORKLOG](AICHAT-24/WORKLOG.md) | #17 |
| AICHAT-28 | Done (merged into the integration branch) | [WORKLOG](AICHAT-28/WORKLOG.md) | #18, #20 |
| AICHAT-32 | Done (merged into the integration branch) | [WORKLOG](AICHAT-32/WORKLOG.md) | #19 |
| AICHAT-30 | Done (merged into the integration branch) | [WORKLOG](AICHAT-30/WORKLOG.md) | #21 |
| AICHAT-22 | Done (merged into the integration branch) | [WORKLOG](AICHAT-22/WORKLOG.md) | #22 |
| AICHAT-21 | Done (merged into the integration branch) | [WORKLOG](AICHAT-21/WORKLOG.md) | #23 |
| AICHAT-19 | Done (merged into the integration branch) | [WORKLOG](AICHAT-19/WORKLOG.md) | #24 |
| AICHAT-26 | Done (merged into the integration branch) | [WORKLOG](AICHAT-26/WORKLOG.md) | #25 |
| AICHAT-33 | Done (merged into the integration branch) | [WORKLOG](AICHAT-33/WORKLOG.md) | #26 |
| AICHAT-29 | In Progress (DoR recorded on its branch; testing not started) | — | — |
| AICHAT-11 | Review (committed on `test/AICHAT-11-contract-testing`, not pushed yet) | [WORKLOG](AICHAT-11/WORKLOG.md) | — |
| AICHAT-12 | Review (committed on `test/AICHAT-12-api-schema-validation`, not pushed yet) | [WORKLOG](AICHAT-12/WORKLOG.md) | — |
| AICHAT-9 | Review, US5 VM run pending | [WORKLOG](AICHAT-9/WORKLOG.md) | #34 |
| AICHAT-13 | Review (committed on `test/AICHAT-13-concurrency`) | [WORKLOG](AICHAT-13/WORKLOG.md) | — |

## Suggested order

Ordered by value, how blocked each epic is, and dependencies between them. The binding order, with waves and start
commands, is in [EPIC-PLAN.md](EPIC-PLAN.md).

1. **Quick wins that unblock others:** AICHAT-34 (coverage enforcement, needed by 17 and by João Vieira's AICHAT-16), AICHAT-31 (history scan; a real `.env.credentials` exists locally), AICHAT-27 (SAST; finds the JWT default secret).
2. **Core LLM risk:** AICHAT-25 (recorded replay; already found 2 defects), then AICHAT-24 (mock LLM reuses the fixtures).
3. **Backend quality:** AICHAT-23 (error paths), AICHAT-20 (DTO snapshots; finds SSE drift).
4. **Unit and frontend quality:** AICHAT-17 (whole repo), AICHAT-18, AICHAT-22, AICHAT-21, AICHAT-19.
5. **Running-system security:** AICHAT-28 (ZAP), AICHAT-30 (SBOM, with João Delgado's AICHAT-6/7), AICHAT-32 (PII).
6. **Needs decisions or features first:** AICHAT-26 (system prompt + budget), AICHAT-33 (deletion feature), AICHAT-29 (pentest last, after the automated tools have removed the easy findings).

## Cross-cutting findings (for the report)

Found while reading the code for this discovery. Each is detailed, with file references, in the epic shown.

| # | Finding | Severity (est.) | Epic |
|---|---|---|---|
| F1 | conversation-service `JWT_SECRET` falls back to a hard-coded default when the env var is missing | High | 27, 29 |
| F2 | Chat membership is granted by email and registration has no email verification, so anyone can register an invited email | High | 29 |
| F3 | No user deletion; uploaded files are never deleted (even on chat delete); no retention job | High (GDPR) | 33 |
| F4 | auth-service logs client IPs, URLs with emails, and possibly `Set-Cookie` tokens; Faro has no scrubbing; the shared redaction package is unused | Medium/High | 32 |
| F5 | No security headers (CSP, HSTS, X-Frame-Options) on the frontends; the LLM API key sits in `sessionStorage` | Medium | 28, 29 |
| F6 | Rate limiting: one global bucket without `trust proxy` in auth-service; none in conversation-service | Medium | 27, 29 |
| F7 | OpenAI mid-stream errors are swallowed; `max_tokens` truncation is shown as a finished answer | Medium (UX/correctness) | 25 |
| F8 | Text/PDF attachments never reach the model (adapters keep only images) | Medium (functional) | 25, 26 |
| F9 | Web fetch has no domain allow-list, and there is no system prompt | Medium | 26 |
| F10 | The k6 load script cannot work against the current API, and its unit test only checks the script text | Medium (test debt) | 24 |
| F11 | Coverage not enforced in 4 of 15 projects; only 1 uses the shared preset | Medium (test debt) | 34 |
| F11b | Only 130 of 246 source files (53%) have their own unit test; 49 (20%) have none (hooks, API clients, 12 components, controllers, ESLint configs) | Medium (test debt) | 17 |
| F12 | SSE event types drifted between mfe-chat and `packages/shared-types` | Low/Medium | 20 |
| F13 | Frontend and backend model-capability tables are duplicated with no parity check | Low/Medium | 17 |
| F14 | Module Federation name `mfe_chat` vs shell's `mfeChat`; react-dom/router/query bundled as fallbacks in every remote | Low | 22 |
| F15 | Google-hosted fonts make visual tests unstable | Low | 19 |
| F16 | Legacy `docker-compose.yml` publishes Postgres on all interfaces, with default passwords | Low (local) | 28 |
| F17 | Private repo: CodeQL, GitHub secret scanning and the SARIF Security tab need paid GitHub Advanced Security | Constraint | 27, 31 |

## Technology summary

| Category | Already in the repo | Proposed additions |
|---|---|---|
| Unit / component | Vitest 5, Testing Library 16, user-event 14, jsdom | MSW (optional), `vitest-axe` (optional) |
| Integration | supertest 7, in-memory fakes | Testcontainers for Node (Postgres) |
| E2E / visual | Playwright 1.63, `@axe-core/playwright` | Playwright Docker image for baselines, self-hosted fonts |
| Performance | Faro → Alloy → Loki → Grafana (vitals panels exist), k6 script | Lighthouse CI, size-limit, mock LLM server, xk6-sse |
| LLM | Adapters with injectable `fetchImpl` | Recorded SSE fixtures, recording script, promptfoo |
| Security | helmet, express-rate-limit (auth only) | Semgrep CE, OWASP ZAP, gitleaks, Syft/BuildKit SBOM, Burp/jwt_tool (manual) |
| CI | GitHub Actions: `ci.yml` (nx affected), `e2e.yml`, `deploy.yml` | `security.yml` (SAST + secrets + DAST), scheduled `prompt-injection.yml`, LHCI job, `size` Nx target |

## Decisions needed from the team (DoR blockers)

1. Performance budgets (AICHAT-21) and bundle size limits (AICHAT-22).
2. Coverage thresholds per project group and the ratchet policy (AICHAT-34).
3. SAST tool: Semgrep CE vs paid CodeQL (AICHAT-27); GitHub secret scanning licence (AICHAT-31).
4. Allow small testability changes in app code: `createApp` dependency injection (AICHAT-23); env-configurable provider base URLs (AICHAT-24/26).
5. System prompt, or a test-only canary (AICHAT-26); red-team API budget.
6. Retention periods and shared-chat behaviour on account deletion; who builds the deletion feature (AICHAT-33).
7. Masking rule for emails/IPs (AICHAT-32).
8. Pentest rules of engagement and environment (staging VM vs production window) (AICHAT-29).
9. Self-hosting fonts (AICHAT-19).
