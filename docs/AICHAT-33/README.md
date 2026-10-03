---
title: "AICHAT-33 · [Foundations] GDPR retention and deletion testing"
---

# AICHAT-33 · [Foundations] GDPR retention and deletion testing

| Field | Value |
|---|---|
| Jira | [AICHAT-33](https://ipca-grupo11.atlassian.net/browse/AICHAT-33) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO, **blocked**: DoR requires a user deletion endpoint that does not exist |
| Related | AICHAT-32 (PII in telemetry), unassigned "Database migration testing" (`prisma db push` vs `migrate`) |
| Layer | Data protection (GDPR Art. 5(1)(e) storage limitation, Art. 17 right to erasure) |

## 1. Goal

**Deleting a user removes their chats, messages, files and telemetry**, checked against a **real Postgres with
Testcontainers**; **retention periods are enforced** by a tested job.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** User deletion, file cleanup, telemetry and retention job (§5) confirmed in scope
- [ ] **Tooling agreed:** Testcontainers Postgres, Prisma `db push` and a separate `test-db` Nx target confirmed
- [ ] Target environment available
- [ ] Retention periods defined → **proposal §5**
- [ ] User deletion endpoint exists → **❌ does not exist (§4.2)**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Deleting a user removes chats, messages, files and telemetry (checked with Testcontainers)
- [ ] Retention job tested

## 3. Technologies

| Tool | Role |
|---|---|
| **Testcontainers for Node** (`testcontainers`, `@testcontainers/postgresql`) | Starts a throwaway `postgres:16-alpine` per test suite from Vitest; needs Docker (GitHub `ubuntu-latest` runners have it) |
| Prisma `6.1.0` | Applies the schema to the container (`prisma db push` today; `prisma migrate deploy` once migrations exist) |
| Vitest `5.0.1` | Runner; a separate `test:integration-db` target so the fast unit loop isn't slowed down |
| supertest | Calls the deletion endpoint end-to-end |
| Temporary directory (`fs.mkdtemp`) | Real upload dir to assert files are removed |
| Loki **delete API** (`POST /loki/api/v1/delete`, needs `deletion_mode: filter-and-delete` and `delete_request_store`) | Telemetry erasure; Loki config already has compactor retention and `delete_request_store: filesystem` |
| Scheduler for the retention job: `node-cron` in-process, a container cron, or a GitHub Actions scheduled workflow calling an admin endpoint | To decide |

## 4. Discovery: current state

### 4.1 Data model (per service, no cross-service relations)

| Service | Model | Personal data | Delete behaviour today |
|---|---|---|---|
| auth | `User` (id, **email**, passwordHash, createdAt) | email, password hash | no delete path |
| auth | `RefreshToken` | session | `onDelete: Cascade` from `User` |
| conversation | `Chat` (ownerId, **ownerEmail**, title, …) | owner email, titles | `DELETE /chats/:id` → `prisma.chat.delete`, DB cascades |
| conversation | `ChatMember` (chatId, **email**) | invited emails | cascade on chat |
| conversation | `Message` (ownerId, **authorEmail**, content, reasoning, webFetches, error) | content | cascade on chat |
| conversation | `Attachment` (ownerId, **storagePath**, extractedText, …) | file contents | cascade on message |
| filesystem | `UPLOAD_DIR/<uuid><ext>` (`/data/uploads` volume) | file contents | **never deleted**: `AttachmentStorage` has only `save`/`read` (`attachments/storage.ts:8-11`) |
| Loki | logs + Faro events, 7-day retention (`observability/loki.yml`) | IPs, URLs (see AICHAT-32) | time-based only |
| Browser | `sessionStorage`/`localStorage` API keys per user id | provider keys | client-side only |

### 4.2 Gaps (blockers)

1. **No user deletion endpoint** in auth-service, and no way for conversation-service to learn that a user was deleted (no events, no shared DB). **DoR not met.**
2. **Attachment files stay on disk** after a chat or message is deleted (orphaned files). This is a GDPR erasure defect even without user deletion.
3. **Shared chats:** if user A deletes their account, what happens to chats where A is a member, and to A's messages in B's chat (`authorEmail`)? A product/legal decision is needed (delete, or anonymise authorship).
4. **No retention job** of any kind (no cron/interval code).
5. **No Testcontainers**, and schemas are applied with `prisma db push` (no migrations), so the test DB setup must use `db push` for now.
6. Telemetry: no user id in Loki labels; erasure of a user's log lines would need a query by correlation id or IP, which is hard. The simpler route is **minimisation** (AICHAT-32) plus the **7-day retention** as the documented erasure mechanism.

## 5. Retention periods (proposal, DoR, to agree with the team)

| Data | Retention | Mechanism |
|---|---|---|
| Account (User) | Until deleted by the user; inactive accounts deleted after 24 months | Retention job |
| Refresh tokens | Delete expired/revoked tokens after 7 days past expiry | Retention job |
| Chats, messages, attachments | Until the user deletes them / their account | Deletion endpoint + cascade + file cleanup |
| Orphaned upload files | Removed within 24 h | Retention job (sweep files with no `Attachment` row) |
| Logs / Faro telemetry (Loki) | 7 days (already configured) | Loki compactor |
| Prometheus metrics (no PII) | Default 15 days | Prometheus |

## 6. Implementation plan (steps)

1. **Product/legal decisions:** retention table (§5); shared-chat behaviour on account deletion (gap 3).
2. **Feature work (prerequisite, not testing; to ticket for the auth/chat owners):**
   - `DELETE /auth/me` (re-authenticate with the password) → delete `User` (cascade refresh tokens) → notify conversation-service (internal authenticated call `DELETE /internal/users/:id`, or an outbox table).
   - conversation-service: delete owned chats (cascade), remove memberships by email, anonymise or delete the user's messages in others' chats, **delete attachment files** (`AttachmentStorage.delete`).
   - Fix orphaned files on chat/message delete (gap 2).
   - Retention job module (`retention/run.ts`) with an injectable clock, called by a scheduler.
3. **Test infrastructure:** `testcontainers` + `@testcontainers/postgresql`; Vitest `globalSetup` that starts Postgres, runs `prisma db push` for each service schema, and exposes `DATABASE_URL`; separate Nx target `test-db` (not in the fast loop, but in CI).
4. **Deletion tests:** seed user A (chats, messages, attachments with real files in a temp dir, membership in B's chat) and user B; call deletion; assert with SQL that no rows reference A's id/email (except agreed anonymised rows), files are gone, B's data is intact.
5. **Retention tests:** freeze time; seed rows on both sides of each limit; run the job; assert only expired data is removed; run twice (idempotent).
6. **Telemetry check:** assert the Loki config keeps `retention_period: 168h` and `retention_enabled: true` (config test, like `packages/workspace-config` tests), and document minimisation (AICHAT-32) as the erasure mechanism for logs.
7. CI: add `test-db` to the `ci.yml` targets (Docker is available on GitHub runners).
8. Document: how to run locally (Docker required), retention table, erasure procedure.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-61](https://ipca-grupo11.atlassian.net/browse/AICHAT-61) | AICHAT-33-US1 | As a data protection owner, I want retention periods and shared-chat deletion rules agreed | §5 approved; decision for shared chats recorded | 1 |
| [AICHAT-79](https://ipca-grupo11.atlassian.net/browse/AICHAT-79) | AICHAT-33-US2 | **(Feature, prerequisite, for auth/chat owners)** As a user, I want to delete my account and all my data | `DELETE /auth/me` + cross-service erasure + file deletion implemented | 8 |
| [AICHAT-97](https://ipca-grupo11.atlassian.net/browse/AICHAT-97) | AICHAT-33-US3 | **(Bug, for chat owner)** As a user, I want my uploaded files removed when I delete a chat or message | Storage `delete`; files removed on cascade | 3 |
| [AICHAT-116](https://ipca-grupo11.atlassian.net/browse/AICHAT-116) | AICHAT-33-US4 | As a developer, I want a Testcontainers Postgres setup for DB-backed tests | `globalSetup`, `test-db` Nx target, runs in CI | 3 |
| [AICHAT-130](https://ipca-grupo11.atlassian.net/browse/AICHAT-130) | AICHAT-33-US5 | As a data protection owner, I want a test proving account deletion erases chats, messages, files and memberships | Testcontainers test from step 4 passes | 5 |
| [AICHAT-137](https://ipca-grupo11.atlassian.net/browse/AICHAT-137) | AICHAT-33-US6 | As a data protection owner, I want the retention job tested at the boundaries | Clock-controlled tests for each §5 row; idempotent | 3 |
| [AICHAT-140](https://ipca-grupo11.atlassian.net/browse/AICHAT-140) | AICHAT-33-US7 | As an operator, I want telemetry retention guaranteed by a config test | Test fails if Loki retention is removed or raised above 7 days | 1 |

## 8. Risks and open decisions

- **Blocked** until US2 (feature) exists. Testing work (US4, US7, and a red test for US3) can start now.
- Cross-service deletion without a shared DB needs a reliable mechanism (retry or outbox). If it isn't reliable, the test must cover partial failure.
- `prisma db push` in tests diverges from production if migrations are introduced later; switch to `migrate deploy` when that happens.

## 9. Notes for the report

The app **cannot currently satisfy the right to erasure**: there is **no account deletion**, **uploaded files are never deleted**
(even when a chat is deleted), and there is **no retention job**. Telemetry already has a 7-day Loki retention, which is a
reasonable erasure mechanism once PII is minimised (AICHAT-32). This epic is blocked by a missing feature; the
plan separates the **feature work** (to ticket for the owners) from the **testing work** (Testcontainers Postgres, deletion and
retention tests) that can start in parallel.
