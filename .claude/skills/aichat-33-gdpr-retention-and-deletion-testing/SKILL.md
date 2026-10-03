---
name: aichat-33-gdpr-retention-and-deletion-testing
description: Run epic AICHAT-33 (GDPR retention and deletion testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-33", "work on AICHAT-33", "continue AICHAT-33".
---

# AICHAT-33 · [Foundations] GDPR retention and deletion testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-33. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-33 · [Foundations] GDPR retention and deletion testing |
| Branch | `test/AICHAT-33-gdpr-retention-and-deletion-testing` |
| Work log | `docs/AICHAT-33/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-33/evidence/` |
| Layer | Data protection (GDPR Art. 5(1)(e) storage limitation, Art. 17 right to erasure) |
| Related | AICHAT-32 (PII in telemetry), unassigned "Database migration testing" (`prisma db push` vs `migrate`) |

## Goal

**Deleting a user removes their chats, messages, files and telemetry**, checked against a **real Postgres with
Testcontainers**; **retention periods are enforced** by a tested job.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-33/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-33/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-33/README.md` |
| Retention periods (proposal, DoR, to agree with the team) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-33/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-33/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: User deletion, file cleanup, telemetry and retention job (§5) confirmed in scope
2. Tooling agreed: Testcontainers Postgres, Prisma `db push` and a separate `test-db` Nx target confirmed
3. Target environment available
4. Retention periods defined → proposal §5
5. User deletion endpoint exists → ❌ does not exist (§4.2)

The proposal to put in front of the owner is in README "Retention periods (proposal, DoR, to agree with the team)".
Open decisions from the analysis (ask the ones not already settled):
  - **Blocked** until US2 (feature) exists. Testing work (US4, US7, and a red test for US3) can start now.
  - Cross-service deletion without a shared DB needs a reliable mechanism (retry or outbox). If it isn't reliable, the test must cover partial failure.
  - `prisma db push` in tests diverges from production if migrations are introduced later; switch to `migrate deploy` when that happens.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-61 | Agree retention periods and shared-chat deletion rules | 1 | §5 approved; decision for shared chats recorded |
| AICHAT-79 | Account deletion endpoint (all user data) | 8 | `DELETE /auth/me` + cross-service erasure + file deletion implemented |
| AICHAT-97 | Remove uploaded files when a chat or message is deleted | 3 | Storage `delete`; files removed on cascade |
| AICHAT-116 | Testcontainers Postgres setup for DB-backed tests | 3 | `globalSetup`, `test-db` Nx target, runs in CI |
| AICHAT-130 | Test that account deletion erases all user data | 5 | Testcontainers test from step 4 passes |
| AICHAT-137 | Retention job boundary tests | 3 | Clock-controlled tests for each §5 row; idempotent |
| AICHAT-140 | Config test for telemetry retention | 1 | Test fails if Loki retention is removed or raised above 7 days |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Deleting a user removes chats, messages, files and telemetry (checked with Testcontainers)
- [ ] Retention job tested
