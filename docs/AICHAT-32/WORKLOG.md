---
title: "AICHAT-32 · PII masking testing: work log"
---

# AICHAT-32 · PII masking testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-32](https://ipca-grupo11.atlassian.net/browse/AICHAT-32) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-32-pii-masking-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which outputs and which data? | Service logs (auth-service, conversation-service), `/metrics` of both services and Faro browser telemetry × email, IP address, message content, tokens/cookies/API keys | Team (owner delegated) |
| Tooling agreed | Met | How do we capture each output? | pino destination stream captured in Vitest + supertest; `/metrics` scraped after traffic; a shared PII detector helper in `@platform/test-utils`; Faro checked with a unit-tested `beforeSend` scrubber and a Vitest capture of the transport payload. No Playwright, because the e2e suite is disabled (owner decision 2026-10-03) | Team (owner delegated) |
| Target environment available | Met | Where do tests run? | In-process in Vitest, so they run in the normal CI `nx affected` test job; no stack needed | Team (owner delegated) |
| PII fields listed | Met | README §4.1 | Email, IP address, message content (also reasoning, extracted text, attachment names), session tokens, cookies, `Set-Cookie`, the LLM API key | Team (owner delegated) |
| Masking rule defined | Met | README §5 proposal | Approved with one change: emails and IPs are **dropped** (not hashed), since we need no correlation and a hash is still personal data under GDPR; message content never logged (lengths/ids only); tokens, cookies, API keys → `[REDACTED]`; query strings dropped from logged URLs | Team (owner delegated) |
| Fixes | Met | Tests first, then fix or ticket? | Tests are written first (red), then we fix the services and the shell in this epic so the acceptance criterion "pass after fixes" is met. Anything outside our code (Caddy access logs, Grafana) is ticketed | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| <tool for this epic> | … | … |

## 3. Steps

### US1 · <story summary> ([AICHAT-<key>](https://ipca-grupo11.atlassian.net/browse/AICHAT-<key>))

**What and why.** …

**Files.**
- `path/to/file` (new): …

**How to run.**

```sh
<one command from the repo root>
```

**How to repeat it manually.**

1. …
2. …
3. Expected output: …

**Result.** …

![<caption>](evidence/01-<what>.png)

**Problems and fixes.** …

### US2 · …

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| … | … | … |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
