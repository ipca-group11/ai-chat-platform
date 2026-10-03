---
name: aichat-11-consumer-driven-contract-testing
description: Run epic AICHAT-11 (Consumer-driven contract testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-11", "work on AICHAT-11", "continue AICHAT-11".
---

# AICHAT-11 · [Foundations] Consumer-driven contract testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-11. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-11 · [Foundations] Consumer-driven contract testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-11-contract-testing` |
| Work log | `docs/AICHAT-11/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-11/evidence/` |
| Layer | MFE ↔ microservice REST boundary |
| Related | AICHAT-12 (schema validation), AICHAT-15-US1 (fix for the stop-route mismatch) |

## Goal

**Every MFE → service REST call has a Pact** written from the real client code, and **each provider verifies those pacts in
CI**, so contract breaks fail before merge.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-11/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-11/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-11/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-11/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: Pact JS V3 consumer tests in Vitest + in-process provider verification (Recommended)
2. Target environment: CI only, no running stack needed
3. `packages/pact-config` set up → confirmed
4. Consumer/provider pairs: the §4.2 table (Recommended); SSE stream out of scope for Pact

Open decisions from the analysis (ask the ones not already settled):
  - **Pact sharing:** CI artifacts within one workflow run (Recommended) vs Pact Broker / PactFlow.
  - Stop-route mismatch: fix in the client (call `POST /chats/:chatId/stop`) (Recommended) or add the route the client expects.

## Stories (run one subagent per story, in this order)

US1 in the main thread. US2 and US3 in parallel (different apps). US4 after US2, US5 after US3. US6 last.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-177 | List consumer/provider pairs and agree how pacts are shared | 1 | Pairs listed with every endpoint each consumer calls; broker vs CI artifacts decided; baseline noted (no pact exists, no consumer depends on `@pact-foundation/pact`) |
| AICHAT-178 | Consumer pacts: mfe-auth, shell and mfe-settings to auth-service | 3 | POST /register, /login, /refresh, /logout and GET /me, success and error; `errorResponseMatcher()` + `correlationHeaderMatcher()`; tests drive the real `features/*/api/*.ts` client code; pact files in PACT_DIR |
| AICHAT-179 | Consumer pacts: mfe-chat to conversation-service | 5 | Chats, members, messages (list/send/edit/cancel/retry/stop) and attachment upload; stop written as the client calls it today (`/chats/:chatId/messages/:messageId/stop`), expected verification failure raised as a defect; multipart upload with a small fixture |
| AICHAT-180 | Provider verification: auth-service | 3 | Verifier starts the app in-process and replays all auth-service pacts; provider states (user exists, valid refresh cookie, expired token) via fakes or test DB; fails on any mismatch |
| AICHAT-181 | Provider verification: conversation-service | 5 | Provider states use `src/test-utils/` fakes and a signed test JWT; owner/member/non-member (403/404) states; stop mismatch fixed (client or provider) and verification passes |
| AICHAT-182 | Contract tests in CI with a merge gate | 3 | Nx `pact:consumer` and `pact:verify` targets in ci.yml; provider job consumes the run's pacts (or broker); run instructions in `packages/pact-config/README.md` |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Every MFE → service REST call has a pact
- [ ] Provider verification runs in CI
