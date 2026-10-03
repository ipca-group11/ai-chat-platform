---
name: aichat-24-load-testing
description: Run epic AICHAT-24 (Load testing) end to end with the epic-workflow process — Jira In Progress, DoR questions to the owner, one subagent per story, evidence and WORKLOG. Use for "start AICHAT-24", "work on AICHAT-24", "continue AICHAT-24".
---

# AICHAT-24 · [Foundations] Load testing

Follow `.claude/skills/epic-workflow/SKILL.md` (process, context rules, agent prompt template, authorship rules).
This file only holds what is specific to AICHAT-24. **Do not read the whole README**; load sections with the commands below.

## Facts

| Item | Value |
|---|---|
| Epic | AICHAT-24 · [Foundations] Load testing |
| Branch | `test/AICHAT-24-load-testing` |
| Work log | `docs/AICHAT-24/WORKLOG.md` (from `docs/templates/WORKLOG.md`) |
| Evidence | `docs/AICHAT-24/evidence/` |
| Depends on | **AICHAT-144 (mock server)**: env-configurable base URLs (AICHAT-43) and the mock LLM (AICHAT-60) moved there |
| Related | AICHAT-25 (fixtures reused by the mock LLM), AICHAT-13 (concurrency) |

## Goal

Find the **saturation point of the production VM** (Azure `Standard_B2als_v2`: 2 vCPU, 4 GB RAM + 4 GB swap):
how many concurrent users and SSE streams it handles before p95 latency or errors go over the limits, and how much memory
each container uses at that point. Use a **mock LLM** so tests cost nothing.

## Context loaders (give agents only the ones they need)

| Need | Command |
|---|---|
| Implementation plan | `awk '/^## 5\. /,/^## 6\. /' docs/AICHAT-24/README.md` |
| Current state / file references | `awk '/^## 4\. /,/^## 5\. /' docs/AICHAT-24/README.md` |
| Technologies and versions | `awk '/^## 3\. /,/^## 4\. /' docs/AICHAT-24/README.md` |
| DoR decisions already taken | `awk '/^## 1\. /,/^## 2\. /' docs/AICHAT-24/WORKLOG.md` |

## DoR review — questions to ask the owner (AskUserQuestion)

Always confirm, in this order, offering the README recommendation first as "(Recommended)":
1. Scope agreed: User and stream scenarios on a VM identical to production (`Standard_B2als_v2`) confirmed in scope
2. Tooling agreed: k6 (xk6-sse or TTFB measurement), mock LLM, `docker stats` sampling and Grafana confirmed
3. Target environment available (the VM, or a VM of the same size)
4. `testing/k6` scenarios for users and streams → exists but broken (§4.1)
5. Mock LLM so it costs nothing → does not exist (§4.2)

Open decisions from the analysis (ask the ones not already settled):
  - **Testing against production** can affect real users. Use an identical temporary VM or a maintenance window.
  - B-series CPU credits make results depend on the credit balance. Record it before and after.
  - Measuring time to first token on SSE needs `xk6-sse` (a custom k6 binary) or a TTFB-based approximation. Decide which.
  - US1 is a code change in conversation-service and must be agreed.

## Stories (run one subagent per story, in this order)

| Jira | Summary | Pts | Acceptance criteria (give verbatim to the agent) |
|---|---|---|---|
| AICHAT-78 | k6 script following the real API flow | 3 | Smoke scenario passes end-to-end against compose + mock |
| AICHAT-96 | Ramping user and streaming scenarios | 3 | `users_ramp`, `streams_ramp`, `soak` scenarios with saturation thresholds |
| AICHAT-114 | Record container memory and CPU during load runs | 2 | `docker stats` sampler script and Grafana panels; CSV kept with the results |
| AICHAT-128 | Document the saturation point on the 4 GB VM | 3 | `RESULTS.md` with users, streams, p95, memory, bottleneck, recommendations |

Suggested agent model: `sonnet` for stories that change code or CI; `haiku` for decision-record / documentation-only stories (1-point "agree…/choose…/document…" stories are usually done in the main thread right after the DoR review).

## Definition of Done (check in the close step)

- [ ] Manual run documented in README/`docs/`
- [ ] Saturation point on the 4 GB VM found and written down (users, streams, p95, memory)
