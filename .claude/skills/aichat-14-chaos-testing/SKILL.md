---
name: aichat-14-chaos-testing
description: Run epic AICHAT-14 (Chaos testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-14", "work on AICHAT-14", "continue AICHAT-14".
---

# AICHAT-14 · [Foundations] Chaos testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-14. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-14 · [Foundations] Chaos testing |
| Owner | João Vieira, Jira accountId `712020:3e736ea6-ad08-4f9f-add5-dcd5309be1bf` (use this, not the default owner in epic-workflow) |
| Branch | `test/AICHAT-14-chaos` |
| Work log | `docs/AICHAT-14/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-14/evidence/` |
| Layer | Infrastructure: compose stack (Postgres, services, LLM link) |
| Depends on | AICHAT-144 (mock LLM + env-configurable provider base URL) for the LLM faults |
| Related | AICHAT-9, AICHAT-15, AICHAT-24 |

## Goal

Inject **Postgres down**, **slow LLM** and **network drop**; prove **clear errors**, **no crash** and **recovery after the
fault ends**. A **scheduled job**, not a merge gate.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-14/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-14/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-14/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-14/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope and tooling agreed: toxiproxy in a `chaos` compose profile + docker stop/start (Recommended)
2. Target environment: local compose; GitHub runner for the schedule
3. toxiproxy / Docker scripts → built in US1
4. Expected degradation per fault: the §4.3 draft (Recommended) / adjust

Open decisions from the analysis (ask the ones not already settled):
  - **LLM timeout:** none exists today; add one (app change, value agreed with the conversation-service owner) or only report it.
  - `/health` returns ok with the DB down in both services: add a readiness check as a follow-up, or only record it.
  - Is the AICHAT-144 base URL available? If not, run Postgres + auth faults first and flag Impediment on US3/US4 LLM parts.

## Stories (run one subagent per story, in this order)

US1 first (harness). US2, US3, US4 in sequence (they share the stack). US5 last.

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-194 | Chaos harness: toxiproxy compose profile and expected degradation | 3 | `chaos` compose profile with toxiproxy in front of Postgres and the LLM endpoint (env-configurable base URL from AICHAT-144); scripts to add/remove toxics (latency, timeout, reset_peer, down) and stop/start containers; expected degradation per fault written down |
| AICHAT-195 | Postgres down: clear errors and recovery without restart | 3 | Postgres stopped idle and mid-request: 5xx with error envelope, no crash, no stack trace; `/health` behaviour recorded; Postgres back: requests succeed without restarting services; recovery time measured |
| AICHAT-196 | Slow or hanging LLM provider | 3 | Latency (e.g. 30 s first byte) and timeout toxics on the LLM link; message ends failed with a readable error after the agreed timeout; queued messages still run (AC-74); Stop works during the hang; missing provider timeout raised as a defect |
| AICHAT-197 | Network drop to the LLM and to auth-service | 3 | reset_peer mid-stream: message failed, not stuck streaming, partial text per agreement; auth-service stopped: login/register show a clear error, existing sessions keep using conversation-service; recovery checked for both |
| AICHAT-198 | Scheduled chaos workflow with a report | 2 | `chaos.yml` on cron + workflow_dispatch, not a merge gate; runs US2–US4 and uploads a summary (fault, expected, observed, pass/fail, recovery time); Grafana screenshots as evidence |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories.

## Definition of Done (check in the close step)

- [ ] Runs as a scheduled job (or documented manual run) and passes on `main`
- [ ] Run instructions added to the project README or `docs/`
- [ ] Postgres down, slow LLM and network drop each tested
- [ ] Clear errors, no crash, recovery after the fault ends
- [ ] Scheduled job, not a merge gate
