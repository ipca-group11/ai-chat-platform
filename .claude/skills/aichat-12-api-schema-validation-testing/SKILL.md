---
name: aichat-12-api-schema-validation-testing
description: Run epic AICHAT-12 (API schema validation testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-12", "work on AICHAT-12", "continue AICHAT-12".
---

# AICHAT-12 · [Foundations] API schema validation testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-12. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-12 · [Foundations] API schema validation testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-12-api-schema-validation` |
| Work log | `docs/AICHAT-12/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-12/evidence/` |
| Layer | Backend HTTP API: auth-service, conversation-service |
| Related | AICHAT-11 (contracts), AICHAT-20 (DTO snapshots, SSE drift), AICHAT-23 (integration tests) |

## Goal

The **request and response of every route** are validated against one agreed Zod schema, an **OpenAPI spec** is generated
from those schemas, and **Schemathesis** fuzzes the running API from the spec in CI.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-12/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-12/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-12/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-12/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: Zod → OpenAPI generator, supertest per route, Schemathesis Docker image
2. Target environment: unit level none; Schemathesis on the compose stack in CI
3. Shared Zod schemas cover every route → **not true today** (§4.2); source of truth decided in US1

Open decisions from the analysis (ask the ones not already settled):
  - **Source of truth:** keep service `shared/contracts` and generate from them (Recommended, less churn) vs move everything to `packages/shared-types`.
  - OpenAPI generator that supports Zod 4 (confirm library and version).
  - Schemathesis in CI: dedicated test user and relaxed auth-service rate limit in the CI stack?

## Stories (run one subagent per story, in this order)

US1 in the main thread. US2 → US5 (spec needed). US3, US4 and US6 can run in parallel with US2.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-183 | Route-to-schema inventory and a single source of truth | 2 | Table of all routes (auth 5 + health/metrics, conversation 16 + SSE) with request/response schema; drift documented (services keep own contracts, only mfe-settings uses shared-types); source-of-truth decision with owners |
| AICHAT-184 | Generate an OpenAPI spec for both services from the Zod schemas | 5 | OpenAPI 3.1 generated from Zod; every route incl. cookie auth and error envelope; committed spec + test failing when stale |
| AICHAT-185 | Response bodies of every route validated against their schema | 5 | Supertest calls each route and strict-parses the body; 4xx/5xx validated against `errorResponseSchema` with X-Correlation-Id; a route without a response schema fails the suite |
| AICHAT-186 | Invalid requests rejected with 400 and field errors | 3 | Table-driven negatives per route (missing, wrong type, too long, extra field, bad param); 400 with `{ error: { code, message, fieldErrors } }`, never 500; upload wrong MIME and oversize rejected |
| AICHAT-187 | Schemathesis run against the OpenAPI spec in CI | 3 | Schemathesis Docker on the compose stack with a test user cookie; checks not_a_server_error, status_code_conformance, response_schema_conformance; findings triaged; merge gate; JUnit uploaded |
| AICHAT-188 | SSE events validated against the shared event schema | 2 | Every event type written by `writeSseEvent` parsed with the SSE schema; mfe-chat `SSEEvent` checked against it, drift with `packages/shared-types/src/chat/sse.ts` fails the build; coordinated with AICHAT-20 |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Request and response of every route validated against the schemas
- [ ] Schemathesis run against the OpenAPI spec
