---
name: aichat-25-provider-adapter-testing-with-recorded-responses
description: Run epic AICHAT-25 (Provider adapter testing with recorded responses ★) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-25", "work on AICHAT-25", "continue AICHAT-25".
---

# AICHAT-25 · [Foundations] Provider adapter testing with recorded responses ★

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-25. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-25 · [Foundations] Provider adapter testing with recorded responses ★ |
| Branch | `test/AICHAT-25-provider-adapter-testing-with-recorded-responses` |
| Work log | `docs/AICHAT-25/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-25/evidence/` |
| Layer | LLM layer (`services/conversation-service/src/features/llm-adapters`) |
| Related | AICHAT-24 (mock LLM can replay the same fixtures), unassigned "Error mapping testing" |

## Goal

Replay **recorded** Anthropic and OpenAI SSE streams through the adapters, covering **text, thinking, `pause_turn`,
`max_tokens` and errors** for each provider, with **no network calls**. This protects the core streaming path without API cost.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-25/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-25/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-25/README.md` |
| Fixture set to record | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-25/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-25/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Fixture set in §5 (Anthropic and OpenAI) confirmed in scope
2. Tooling agreed: Vitest, recorded `.sse`/`.json` fixtures, replay helper and no-network setup file confirmed
3. Target environment available
4. Recorded Anthropic and OpenAI SSE fixtures → none exist (§4.3)

The proposal to put in front of the owner is in README "Fixture set to record".
Open decisions from the analysis (ask the ones not already settled):
  - Recording needs real API keys and costs a few cents. Run it manually, never in CI.
  - Provider wire formats change (new event types such as `citations_delta`). Re-record each quarter or when upgrading API versions (`anthropic-version: 2023-06-01`).
  - Fixtures must not contain API keys or personal data. The script must scrub `request_id`/`id` values.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-46 | Script to record real provider streams | 3 | Script records the §5 success scenarios for both providers; secrets and ids stripped; documented |
| AICHAT-64 | Replay helper that splits fixtures at arbitrary byte offsets | 2 | `replaySse`, `replayHttpError`, `replayFetch` in `test-utils`; UTF-8 split case passes |
| AICHAT-82 | Fail tests on any real network call | 1 | Vitest setup file stubs `fetch`; a test proves it throws |
| AICHAT-99 | Replay tests for text, thinking, pause_turn, max_tokens and errors | 5 | All §5 fixtures replayed with exact assertions |
| AICHAT-117 | Show truncated or failed answers as incomplete | 2 | Tickets raised for OpenAI mid-stream errors and max_tokens truncation; tests updated once fixed |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Replay covers text, thinking, `pause_turn`, `max_tokens` and errors per provider
- [ ] No network calls
