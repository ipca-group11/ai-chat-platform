---
title: "AICHAT-28 · DAST: work log"
---

# AICHAT-28 · DAST: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-28](https://ipca-grupo11.atlassian.net/browse/AICHAT-28) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-28-dast` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | What is scanned, passive or active? | The local compose stack (shell on `:8000` plus the auth and conversation APIs) with the LLM mock; production is excluded. Passive baseline is the gate; the active API scan runs weekly and on demand only | Team (owner delegated) |
| Tooling agreed | Met | Which tool and configuration? | OWASP ZAP (`zaproxy/zap-stable`): `zap-baseline.py` with the AJAX spider (`-j`) for the React app, `testing/zap/rules.tsv` (High → FAIL, Medium → WARN, Low/Info → IGNORE, each IGNORE with a reason), `zap-api-scan.py` for the weekly API scan | Team (owner delegated) |
| Target environment available | Met | Where does the stack run? | Locally and on the CI runner with `pnpm mock:up llm` (same steps as `e2e.yml`, without Playwright) | Team (owner delegated) |
| CI trigger | Met | The full e2e suite was moved off pull requests because it is slow; how often does DAST run? | Own workflow `dast.yml`: pull requests to `main`, pushes to `integration/testing-epics` and `main`, `workflow_dispatch`; the API scan weekly (cron) and on demand. A High alert fails the job | Team (owner delegated) |
| Authentication | Met | How does ZAP see the pages behind sign-in? | A seeded test user signs in before the scan; its session cookie is injected with a ZAP replacer rule, so `/chats`, `/settings` and `/api/*` are crawled | Team (owner delegated) |
| OpenAPI spec | Met | AICHAT-121 depends on the AICHAT-12 spec, which does not exist yet | We write a small OpenAPI 3 file for the scan in `testing/zap/` from the Express routes; it is replaced by the AICHAT-12 spec when that lands | Team (owner delegated) |
| Security header findings | Met | Fix or ticket? | Ticket the Caddyfile header fixes to the deploy owner (Jira), no fix in this epic | Team (owner delegated) |
| Legacy `docker-compose.yml` | Met | It exposes Postgres and Grafana with default passwords | Ticket only (removal touches deploy docs owned by others) | Team (owner delegated) |

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
