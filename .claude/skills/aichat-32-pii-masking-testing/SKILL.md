---
name: aichat-32-pii-masking-testing
description: Run epic AICHAT-32 (PII masking testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-32", "work on AICHAT-32", "continue AICHAT-32".
---

# AICHAT-32 · [Foundations] PII masking testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-32. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-32 · [Foundations] PII masking testing |
| Branch | `test/AICHAT-32-pii-masking-testing` |
| Work log | `docs/AICHAT-32/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-32/evidence/` |
| Layer | Security / privacy in telemetry |
| Related | AICHAT-33 (GDPR), unassigned "API key handling testing" (same capture technique), observability (Faro, Loki, Prometheus) |

## Goal

Emails, IP addresses and message content are **masked** in **logs**, **`/metrics`** and **Faro** browser telemetry.
Tests capture each of these outputs and assert that **no raw PII** appears.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 6\. /,/^## 7\. /' docs/AICHAT-32/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-32/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-32/README.md` |
| Masking rule (proposal, DoR) | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-32/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-32/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: Logs, `/metrics` and Faro payloads × email/IP/message content/tokens confirmed in scope
2. Tooling agreed: pino stream capture, shared PII detector helper and Playwright `/collect` capture confirmed
3. Target environment available
4. PII fields listed (email, IP, message content) → §4.1
5. Masking rule defined → proposal §5

The proposal to put in front of the owner is in README "Masking rule (proposal, DoR)".
Open decisions from the analysis (ask the ones not already settled):
  - Fixes are code changes in services and shell; tests can be written first (expected red) and the fixes ticketed to owners.
  - Hashing emails still links records over time (pseudonymisation, still personal data under GDPR), so prefer dropping when correlation isn't needed.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-58 | Agree PII fields and masking rule | 1 | §4.1 and §5 approved |
| AICHAT-75 | Reusable PII detector test helper | 2 | Helper with email/IP/token/canary detection + unit tests |
| AICHAT-94 | No email, IP or message content in service logs | 5 | Log-capture tests for both services across all routes; pass after fixes |
| AICHAT-112 | No session tokens in logs | 2 | Test proves `Set-Cookie`/cookies/API key are redacted in auth- and conversation-service logs |
| AICHAT-127 | No PII in /metrics | 1 | Scrape test after traffic; unmatched-route test |
| AICHAT-136 | Scrub PII from Faro browser telemetry | 3 | `beforeSend` scrubber unit-tested; Playwright capture of `/collect` shows no PII |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Log, `/metrics` and Faro payloads captured in tests
- [ ] No raw PII found
