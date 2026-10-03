---
name: aichat-23-integration-testing
description: Run epic AICHAT-23 (Integration testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-23", "work on AICHAT-23", "continue AICHAT-23".
---

# AICHAT-23 · [Foundations] Integration testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-23. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-23 · [Foundations] Integration testing |
| Branch | `test/AICHAT-23-integration-testing` |
| Work log | `docs/AICHAT-23/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-23/evidence/` |
| Layer | Backend HTTP routes (Express) |
| Related | AICHAT-34 (coverage), unassigned "Authorization / IDOR testing" (overlaps the 403/404 paths) |

## Goal

Test **every Express route** of `auth-service` and `conversation-service` through HTTP with **supertest**, using
**fake repositories** instead of Postgres, **including the error paths** (400, 401, 403/404, 409, 422, 500).

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-23/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-23/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-23/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-23/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: The 24 routes in §4.2 and their error paths confirmed in scope
2. Tooling agreed: Vitest + supertest + in-memory fakes confirmed; `createApp` dependency-injection approach agreed with the service owners
3. Target environment available
4. Fake repositories available for each service → partly: conversation-service yes, auth-service no (§4.3)

Open decisions from the analysis (ask the ones not already settled):
  - US2 needs a small change to `createApp` (dependency injection). It is a testability refactor, so it must be agreed with the service owners.
  - Some cross-user cases overlap the unassigned **Authorization / IDOR** test type (the #1 suggested priority in `TEST-TYPES.md`). Recommendation: this epic covers one IDOR case per route; a dedicated IDOR epic should cover the full matrix.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-40 | Shared in-memory fakes (provider registry, queue, Prisma) | 2 | Fakes in `test-utils`; duplicates removed |
| AICHAT-57 | Testable conversation-service app with injected fakes | 3 | `createApp` overrides (agreed with the service owner); one full-app suite runs every route |
| AICHAT-76 | Membership operations return clear 4xx errors | 3 | Tests for `CANNOT_INVITE_SELF`, `ALREADY_A_MEMBER`, `FORBIDDEN`, `MEMBER_NOT_FOUND`, not-a-member, non-owner |
| AICHAT-93 | Message edit/cancel/retry reject invalid states | 3 | 409 `MESSAGE_NOT_EDITABLE/CANCELABLE/RETRYABLE`, 404 and 400 tested |
| AICHAT-111 | Attachment upload error paths | 2 | 404, 422 no-vision, cross-user, 413 size limit tested |
| AICHAT-125 | Unexpected errors return a safe 500 | 2 | One 500 test per router in both services; no stack trace in the body |
| AICHAT-131 | Guard test for routes without integration tests | 2 | Route-inventory test in both services |
| AICHAT-134 | auth-service edge case integration tests | 2 | expired refresh, logout without cookie, `/me` for a deleted user, malformed login body |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Every Express route tested with supertest and fake repositories, including error paths
