---
title: "AICHAT-32 · [Foundations] PII masking testing"
---

# AICHAT-32 · [Foundations] PII masking testing

| Field | Value |
|---|---|
| Jira | [AICHAT-32](https://ipca-grupo11.atlassian.net/browse/AICHAT-32) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-33 (GDPR), unassigned "API key handling testing" (same capture technique), observability (Faro, Loki, Prometheus) |
| Layer | Security / privacy in telemetry |

## 1. Goal

Emails, IP addresses and message content are **masked** in **logs**, **`/metrics`** and **Faro** browser telemetry.
Tests capture each of these outputs and assert that **no raw PII** appears.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** Logs, `/metrics` and Faro payloads × email/IP/message content/tokens confirmed in scope
- [ ] **Tooling agreed:** pino stream capture, shared PII detector helper and Playwright `/collect` capture confirmed
- [ ] Target environment available
- [ ] PII fields listed (email, IP, message content) → **§4.1**
- [ ] Masking rule defined → **proposal §5**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Log, `/metrics` and Faro payloads captured in tests
- [ ] No raw PII found

## 3. Technologies

| Tool | Role |
|---|---|
| **pino** `^10` `redact` option (fast-redact) | Path-based masking in both services |
| **pino-http** `^10.5` | Request/response logging in auth-service (default serializers log URL, headers, `remoteAddress`) |
| `pino` destination stream capture (e.g. `pino(opts, stream)` with an in-memory `Writable`, or `pino-test`) | Captures every log line in Vitest |
| supertest | Drives real requests through the app while logs are captured |
| **prom-client** `^15` | `/metrics`; test scrapes the text output |
| **Grafana Faro Web SDK** `^2.12` `beforeSend` hook | Scrubs browser telemetry before sending |
| Playwright `page.route('**/collect')` | Captures Faro payloads in an E2E test |
| Shared PII detector (to build): regexes for email, IPv4/IPv6, known message-content canaries | One assertion helper used by all three capture tests |

## 4. Discovery: current state

### 4.1 Where PII exists

| PII | Stored / sent | Telemetry risk |
|---|---|---|
| **Email** | auth `User.email`; conversation `Chat.ownerEmail`, `Message.authorEmail`, `ChatMember.email`; JWT `email` claim; membership routes put the email **in the URL** (`DELETE /chats/:id/members/:email`) | Logged URLs (auth-service pino-http); Faro page URLs if a page path contains it; error logs with `path` (`auth-service/src/shared/error-middleware.ts:68`) |
| **IP address** | Not stored | auth-service pino-http logs `req.remoteAddress`/`remotePort` by default (behind proxies this is the shell container's IP, still an IP field) |
| **Message content** | `Message.content`, `reasoning`, attachment `extractedText` | Not logged explicitly; provider error text is stored in `Message.error`; Faro `captureConsole: true` would send any `console.*` that prints content |
| **Tokens/keys** (not PII but same technique) | cookies, `X-Llm-Api-Key` | auth-service: **`Set-Cookie` response header is not redacted** (pino-http's default `res` serializer logs headers, so access and refresh tokens from `/auth/login` and `/auth/refresh` can reach the logs) |

### 4.2 Current masking

| Component | Masking today | Gap |
|---|---|---|
| auth-service `shared/logger.ts` | Redacts password/newPassword/passwordHash/token/accessToken/refreshToken/authorization/cookie (several depths) and `req.headers.authorization/cookie` | **No email, no IP (`req.remoteAddress`), no `res.headers["set-cookie"]`**; URL not scrubbed |
| conversation-service `shared/logger.ts` | Redacts `x-llm-api-key`, cookie, authorization headers, `*.apiKey`, `*.password` | No email; no request logging middleware (so less exposure); `app.ts:57` logs chatId/messageId (ids, fine) |
| `packages/observability/src/logging/redaction.ts` | Shared `SENSITIVE_KEYS` + recursive `redact()` | **Not imported by either service** (dead shared code); no email/IP keys |
| Metrics | Labels: `method`, `route` (template, e.g. `/chats/:id/members/:email`), `status`; `active_streams` unlabelled | **Looks clean**, since route templates are used. Test needed to keep it that way (an `unmatched` route must never fall back to the raw path) |
| Faro (`apps/shell/src/shared/observability/faro.ts`) | **No `beforeSend`, no URL scrubbing**; `captureConsole: true`; no `setUser` | Page URLs (chat ids, fine; an email in a URL would not be) and console output go to Loki unfiltered |
| Loki retention | 7 days (`observability/loki.yml`, compactor retention enabled) | Relevant for AICHAT-33 |

## 5. Masking rule (proposal, DoR)

| Data | Rule |
|---|---|
| Email | Replace with `u***@d***.tld`, or better a **keyed hash** (`sha256(email + pepper)` truncated) when correlation is needed; never the raw value |
| IP | Drop from logs, or keep /24 (IPv4) / /48 (IPv6) only |
| Message content, reasoning, extracted text, attachment names | **Never** logged or sent to telemetry; log lengths/ids only |
| Tokens, cookies, API keys, `Set-Cookie` | `[REDACTED]` |
| URLs | Path params that are emails replaced with `:email`; query strings dropped |

## 6. Implementation plan (steps)

1. Approve the PII list and masking rule (§4.1, §5).
2. Build a **PII detector helper** (`packages/test-config` or `packages/observability`): `findPii(text, { canaries })` → matches for email regex, IPv4/IPv6 regex, known test canaries (a unique message string like `PII-CANARY-7f3a`), and token patterns.
3. **Log capture tests (both services):** create the app with a logger writing to an in-memory stream; drive register/login/refresh/me, create chat, invite member by email, send a message containing the canary, upload a file, trigger 4xx/5xx; assert `findPii(allLogLines)` is empty. Expected first result: **fails** on IP, `set-cookie`, URL with email → fixes to agree (redact paths, custom pino-http serializers).
4. **Metrics test:** after the same traffic, scrape `/metrics` and assert no PII; plus a test that an unmatched URL containing an email is labelled `unmatched`.
5. **Faro test:** unit test for a new `beforeSend` scrubber (URLs, console messages, exception values); Playwright test that intercepts `**/collect` during login + chat with the canary and asserts no PII in the captured payloads.
6. Fixes (agree with owners): use `packages/observability` redaction in both services; add `res.headers["set-cookie"]`, `req.remoteAddress`, email paths; custom `req` serializer that drops query strings and masks emails in URLs; Faro `beforeSend` + `captureConsole` limited to `warn/error`.
7. CI: the log/metrics tests run in `nx affected -t test`; the Faro E2E in `e2e.yml`.
8. Document the rule and how to add a new PII field.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-58](https://ipca-grupo11.atlassian.net/browse/AICHAT-58) | AICHAT-32-US1 | As a privacy owner, I want the PII fields and masking rule agreed | §4.1 and §5 approved | 1 |
| [AICHAT-75](https://ipca-grupo11.atlassian.net/browse/AICHAT-75) | AICHAT-32-US2 | As a developer, I want a reusable PII detector helper so that every capture test checks the same way | Helper with email/IP/token/canary detection + unit tests | 2 |
| [AICHAT-94](https://ipca-grupo11.atlassian.net/browse/AICHAT-94) | AICHAT-32-US3 | As a user, I want my email, IP and messages never written to service logs | Log-capture tests for both services across all routes; pass after fixes | 5 |
| [AICHAT-112](https://ipca-grupo11.atlassian.net/browse/AICHAT-112) | AICHAT-32-US4 | As a user, I want my session tokens never logged | Test proves `Set-Cookie`/cookies/API key are redacted in auth- and conversation-service logs | 2 |
| [AICHAT-127](https://ipca-grupo11.atlassian.net/browse/AICHAT-127) | AICHAT-32-US5 | As an operator, I want `/metrics` to never contain PII | Scrape test after traffic; unmatched-route test | 1 |
| [AICHAT-136](https://ipca-grupo11.atlassian.net/browse/AICHAT-136) | AICHAT-32-US6 | As a user, I want browser telemetry (Faro) scrubbed | `beforeSend` scrubber unit-tested; Playwright capture of `/collect` shows no PII | 3 |

## 8. Risks and open decisions

- Fixes are code changes in services and shell; tests can be written first (expected red) and the fixes ticketed to owners.
- Hashing emails still links records over time (pseudonymisation, still personal data under GDPR), so prefer dropping when correlation isn't needed.

## 9. Notes for the report

Metrics are already clean (route templates as labels). Logs and browser telemetry are not: auth-service's
`pino-http` logs **client IPs and full URLs** (membership URLs contain **emails**), and the default response serializer can log the
**`Set-Cookie` header with access and refresh tokens**. Faro has **no `beforeSend` scrubbing**. A shared redaction module exists in
`packages/observability` but **no service uses it**. The plan adds capture tests for logs, `/metrics` and Faro using a shared PII
detector, expected to fail first and drive the fixes.
