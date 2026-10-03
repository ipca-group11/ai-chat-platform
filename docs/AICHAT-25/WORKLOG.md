---
title: "AICHAT-25 · Provider adapter testing with recorded responses: work log"
---

# AICHAT-25 · Provider adapter testing with recorded responses: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-25](https://ipca-grupo11.atlassian.net/browse/AICHAT-25) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-25-provider-adapter-testing-with-recorded-responses` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Is the fixture set of README §5 (Anthropic and OpenAI) in scope? | Yes; replay helper in `test-utils`, a no-network setup file, runs in CI without keys | Owner |
| Tooling agreed | Met | How are the streams recorded without a paid API? (plan decision D5) | Recorded from a local Ollama model through its OpenAI- and Anthropic-compatible endpoints; cases Ollama cannot produce (thinking, `pause_turn`, provider errors) written by hand from the provider documentation and marked as hand-written | Owner |
| Target environment available | Met | Where does it run? | Recording: manually on a laptop with Ollama, never in CI. Replay: locally and in GitHub Actions | Owner |
| Defects found by the replay (AICHAT-117) | Met | Fix now or ticket? | Ticket only; tests assert the current behaviour and reference the ticket | Owner |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Ollama | `ollama --version` → … (model `llama3.2:1b`) | `brew install ollama` |

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
