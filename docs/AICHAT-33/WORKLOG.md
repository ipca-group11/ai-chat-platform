---
title: "AICHAT-33 · GDPR retention and deletion testing: work log"
---

# AICHAT-33 · GDPR retention and deletion testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-33](https://ipca-grupo11.atlassian.net/browse/AICHAT-33) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-33-gdpr-retention-and-deletion-testing` |
| Started / finished | 2026-10-04 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-04

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which stories? | All seven stories: retention decision (US1), account deletion endpoint `DELETE /auth/me` (US2, the feature is built in this epic), file cleanup on chat/message delete (US3), Testcontainers setup (US4), erasure test (US5), retention job boundary tests (US6), Loki retention config test (US7) | Team (owner delegated) |
| Tooling agreed | Met | Test database? | Testcontainers with the official `postgres` image (native arm64/amd64, no emulation), schema applied with `prisma db push` (no migrations exist yet; switch to `migrate deploy` when they are added). DB tests run in a separate `test-db` Nx target so the unit `test` target stays fast; CI runs `test-db` on GitHub runners, which have Docker | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Local Docker and the GitHub Actions runner. No shared or production database is touched | Team (owner delegated) |
| Retention periods defined | Met | README §5 proposal | Approved as proposed: inactive accounts 24 months, expired/revoked refresh tokens 7 days after expiry, chats/messages/attachments until the user deletes them or the account, orphaned upload files within 24 h, Loki 7 days, Prometheus 15 days (no PII) | Team (owner delegated) |
| Shared chats | Met | What happens to a deleted user's data in shared chats? | Chats the user owns are deleted for everyone (with all messages and files). In chats owned by others, the user's membership row and the messages and attachments they wrote are deleted; assistant replies stay. Erasure wins over conversation context | Team (owner delegated) |
| Cross-service deletion | Met | Retry or outbox? | auth-service calls an internal conversation-service erasure endpoint (service token) first and deletes the `User` row only after it succeeds. Every step is idempotent, so a failure leaves the account in place and the user (or a retry) can repeat the request; the test covers this partial failure | Team (owner delegated) |
| Telemetry erasure | Met | How are log lines erased? | Minimisation (AICHAT-32) plus the 7-day Loki retention is the documented erasure mechanism; US7 guards the retention value | Team (owner delegated) |

Blockers: none. The deletion endpoint did not exist (README §4.2); we build it as US2 in this epic.

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
