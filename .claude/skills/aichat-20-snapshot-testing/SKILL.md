---
name: aichat-20-snapshot-testing
description: Run epic AICHAT-20 (Snapshot testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-20", "work on AICHAT-20", "continue AICHAT-20".
---

# AICHAT-20 · [Foundations] Snapshot testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-20. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-20 · [Foundations] Snapshot testing |
| Branch | `test/AICHAT-20-snapshot-testing` |
| Work log | `docs/AICHAT-20/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-20/evidence/` |
| Layer | Shared types / API payloads |
| Related | AICHAT-12 (API schema validation), AICHAT-11 (Pact), unassigned "SSE event contract testing" |

## Goal

Use snapshots **only for small, stable serialized outputs (DTOs)**: API responses, SSE events, error bodies. Never
snapshot large component trees, which become brittle and get rubber-stamped with `-u`.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-20/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-20/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-20/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-20/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: DTOs and wire outputs in §4.2 confirmed as the only snapshot targets (no component trees)
2. Tooling agreed: Vitest inline/file snapshots, UUID/date serializer and `vitest/no-large-snapshots` lint rule confirmed
3. Target environment available
4. DTOs to snapshot listed → §4.2

Open decisions from the analysis (ask the ones not already settled):
  - Snapshots lose value if updated without review. The PR template should ask "why did this snapshot change?".
  - The overlap with Pact (AICHAT-11) and API schema validation (AICHAT-12): snapshots check *shape stability*, Pact checks *consumer expectations*, schema validation checks *validity*. They complement each other.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-42 | Canonical DTO fixtures | 2 | One fixture per schema in §4.2, each passing `schema.parse` |
| AICHAT-59 | Snapshot tests for shared DTOs | 3 | Inline/file snapshots for all §4.2 schemas; UUIDs/dates normalised |
| AICHAT-77 | Snapshot tests for SSE frames and error bodies | 3 | Snapshots of `streaming/sse.ts` frames and error middleware output in both services |
| AICHAT-95 | Lint rule against component-tree and large snapshots | 2 | ESLint rule active in `packages/eslint-config`; a test `.tsx` with `toMatchSnapshot` fails lint |
| AICHAT-113 | Detect SSE type drift between mfe-chat and shared-types | 1 | Issue raised to the chat owner with the two definitions side by side |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Only serialized DTOs snapshotted
- [ ] No component-tree snapshots remain
