---
name: aichat-26-prompt-injection-testing
description: Run epic AICHAT-26 (Prompt injection testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-26", "work on AICHAT-26", "continue AICHAT-26".
---

# AICHAT-26 · [Foundations] Prompt injection testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-26. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-26 · [Foundations] Prompt injection testing |
| Branch | `test/AICHAT-26-prompt-injection-testing` |
| Work log | `docs/AICHAT-26/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-26/evidence/` |
| Layer | LLM layer / security |
| Related | AICHAT-144 (mock server: base URL change and mock LLM), AICHAT-25 (text attachments defect), AICHAT-29 (pentest) |

## Goal

Show that malicious text in **uploaded files** or **web-fetched pages** (indirect prompt injection) cannot make the
assistant **leak its system prompt** or **misuse its tools** (web fetch). Run a defined attack set with **promptfoo red-team** on a schedule.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-26/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-26/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-26/README.md` |
| Attack set (proposal, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-26/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-26/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Attack set A1–A8 (§5), target model and API budget cap confirmed
2. Tooling agreed: promptfoo red-team with an HTTP target to the app API confirmed; garak adopted or rejected
3. Target environment available
4. Attack set defined for uploaded files and web-fetched pages → proposal in §5

The proposal to put in front of the owner is in README "Attack set (proposal, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - **Costs real API tokens**: needs a budget and a cheap model.
  - The web-fetch payload pages must be public; keep them harmless (no real exfiltration endpoint, or a logging endpoint the team owns).
  - LLM-graded results are non-deterministic; that is acceptable for a scheduled job, not for a merge gate (as the DoD says).
  - A2 can only pass after text attachments actually reach the model (AICHAT-25 finding).

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-48 | Define the attack set for files and web pages | 3 | §5 approved; attack pages hosted; payload files in `testing/promptfoo/payloads` |
| AICHAT-66 | promptfoo driving the real app API | 5 | HTTP target wrapper does login/chat/upload/send/SSE; one manual run produces a report |
| AICHAT-84 | Assertions for system-prompt leak and tool misuse | 3 | Canary + fetched-URL + llm-rubric assertions per attack |
| AICHAT-102 | Weekly non-blocking red-team run | 2 | Scheduled workflow with artifact report; cost cap documented |
| AICHAT-120 | Fix or ticket the injection risks found | 2 | Findings list with mitigations (domain allow-list, system prompt rules, markdown images) |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs as a scheduled job; run instructions documented
- [ ] promptfoo red-team runs the set
- [ ] No system-prompt leak or tool misuse
- [ ] Scheduled job, not a merge gate
