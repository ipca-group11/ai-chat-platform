---
title: "AICHAT-26 · Prompt injection testing: work log"
---

# AICHAT-26 · Prompt injection testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-26](https://ipca-grupo11.atlassian.net/browse/AICHAT-26) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-26-prompt-injection-testing` |
| Started / finished | 2026-10-04 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-04

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Attack set, model and budget? | Attack set A1–A8 of README §5. Target model: the cheapest Anthropic model the app offers (Haiku class). Hard budget cap of USD 2 per run, recorded in the config and the workflow; the grader of `llm-rubric` uses the same cheap model | Team (owner delegated) |
| Tooling agreed | Met | promptfoo, garak? | promptfoo red-team with a custom HTTP target (TypeScript) that drives the real app API: sign in, create chat, upload, send, read the SSE stream. garak is not adopted (no HTTP-SSE target, overlaps promptfoo) | Team (owner delegated) |
| Target environment available | Met | Where does it run? | The compose stack locally. The harness is first proven against the LLM mock (free, deterministic, a scripted "obeying" reply proves the assertions catch a leak). Real-model runs are manual or weekly, never a merge gate | Team (owner delegated) |
| Attack set defined | Met | README §5 | Approved as proposed. Payload files in `testing/promptfoo/payloads`; attack web pages are served by a small local container the team owns (no public hosting, no real exfiltration endpoint, `attacker.example` URLs only). If the web-fetch guard blocks private addresses, the test stack allows the payload host by configuration only, never in production | Team (owner delegated) |
| A2 text attachments | Met | Text files do not reach the model today (AICHAT-25 finding) | A2 is kept in the set and expected to show the gap; it is reported, not counted as a pass | Team (owner delegated) |
| Real API key | Met | Which key pays? | The team key from the local, git-ignored credentials file, read by name only; never printed, logged or committed. In CI the weekly job uses a repository secret and skips when it is absent | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| <tool for this epic> | … | … |

## 3. Steps

### US1 · <story summary> ([AICHAT-<key>](https://ipca-grupo11.atlassian.net/browse/AICHAT-<key>))

**What and why.** …

**Files.**
- `path/to/file` (new): …

**How to run.**

```sh
<one command from the repo root>
```

**How to repeat it manually.**

1. …
2. …
3. Expected output: …

**Result.** …

![<caption>](evidence/01-<what>.png)

**Problems and fixes.** …

### US2 · …

## 4. How to run everything

```sh
# all checks added by this epic, from the repo root
```

## 5. Results

| Metric | Before | After |
|---|---|---|
| … | … | … |

## 6. DoD check

| DoD item | Met | Evidence |
|---|---|---|
| … | ✅ | [link](evidence/…) |

## 7. Notes for the report

- What was found
- What was fixed / waived
- Lessons learned
