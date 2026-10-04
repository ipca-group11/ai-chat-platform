---
title: "Retention and erasure rules"
---

# Retention and erasure rules (AICHAT-33)

How long the platform keeps personal data, what happens when a user deletes their account, and which code enforces
each rule. The numbers were agreed in the DoR review of AICHAT-33 (see `WORKLOG.md` §1).

## Retention table

| Data | Retention | Enforced by |
|---|---|---|
| Account (`User`: email, password hash) | Until the user deletes it. Accounts with no sign-in or token refresh for 24 months are deleted | `DELETE /auth/me`; auth-service retention job |
| Refresh tokens | Deleted 7 days after they expire (expired or revoked alike) | auth-service retention job; cascade on account deletion |
| Chats, messages, attachments (rows and files) | Until the user deletes them or deletes the account | `DELETE /chats/:id`, message cancel and the erasure endpoint, all removing the files too |
| Orphaned upload files (a file with no `Attachment` row) | Removed within 24 hours | conversation-service retention job |
| Logs and Faro events (Loki) | 7 days, or earlier on request by correlation or session id | `observability/loki.yml` (`retention_period: 168h`, delete API enabled), guarded by a config test; `scripts/gdpr/loki-delete.ts` |
| Prometheus metrics (no personal data) | 15 days (Prometheus default) | Prometheus |

## Shared chats

When a user deletes their account:

- Chats the user **owns** are deleted for everyone: the chat, its members, all messages (including the assistant
  replies) and all attachment rows and files.
- In chats owned by **someone else**, the user's membership row and the messages and attachments they wrote are deleted.
  Assistant replies in those chats stay, because they belong to the chat owner.

Erasure wins over conversation context: the other participants may see a gap in the conversation.

## ADR: cross-service account deletion

**Context.** auth-service owns the `User` row and conversation-service owns the chats, and the two have no shared
database and no event bus.

**Decision.** `DELETE /auth/me` first calls an internal conversation-service endpoint (`POST /internal/erasures`,
protected by a service token from the environment). Only when that call succeeds does auth-service delete the `User`
row (refresh tokens cascade) and clear the cookies. Every step is idempotent: erasing a user who has no data left is a
success.

**Consequences.**

- If conversation-service is down or fails, the user still exists, the API answers `502` and the same request can be
  repeated. No outbox table or queue is needed, and a half-erased state never loses the ability to finish.
- If the `User` row delete fails after the chats were erased, a retry finds nothing to erase and deletes the row.
- The inactive-account retention job uses the same flow, so it also erases the chats of the accounts it removes.
- Without `INTERNAL_SERVICE_TOKEN` (or the conversation-service URL) `DELETE /auth/me` answers `503` and deletes
  nothing: a partial deletion is never done silently.

**Telemetry.** Log lines carry no user id; minimisation (AICHAT-32) plus the 7-day Loki retention is the erasure
mechanism for them. The config test keeps the 7 days from being removed or raised.

**Telemetry erasure on request (AICHAT-249).** When a user asks for their telemetry to be erased before the 7 days, and
gives an identifier that appears in the lines (the `X-Correlation-Id` of a request, or the Faro session id), run
`scripts/gdpr/loki-delete.ts --id <value>` (dry run, counts the lines), then again with `--yes`. Loki hides and purges
the matching lines once the 1-hour cancel period is over; `--list` shows the status. Lines without the identifier are
still erased by the 7-day retention. Commands: `WORKLOG.md`, section 3, AICHAT-249.

## How to run the checks

Docker must be running for the database tests (Testcontainers starts `postgres:16-alpine`, the version compose uses).

```sh
# unit tests, no Docker needed
pnpm exec nx run-many -t test -p auth-service,conversation-service,workspace-config

# database tests: account deletion across both services, retention boundaries (real Postgres, real files)
pnpm exec nx run-many -t test-db -p auth-service,conversation-service --parallel=1

# Loki retention and deletion guard
pnpm exec nx test workspace-config

# telemetry erasure script (fetch mocked)
node --test scripts/gdpr/loki-delete.test.ts
```

The retention jobs run every `RETENTION_INTERVAL_MINUTES` (default 360, `0` turns them off) in each service.
`INTERNAL_SERVICE_TOKEN` (at least 32 characters, the same value in both services) and `CONVERSATION_SERVICE_URL`
(auth-service) must be set for account deletion; the compose files set them for local use.
