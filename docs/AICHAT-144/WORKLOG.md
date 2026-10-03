---
title: "AICHAT-144 · Mock server: work log"
---

# AICHAT-144 · Mock server: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-144](https://ipca-grupo11.atlassian.net/browse/AICHAT-144) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-144-mock-server` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which mocks are in scope (README §5)? | LLM providers (Anthropic, OpenAI), auth-service and conversation-service APIs, MFE remotes and the telemetry sink | Owner |
| Tooling agreed | Met | Stack and location? | Node + Express, one process with one router per mock, Nx project `testing/mock-server`, Docker image, compose profiles | Owner |
| Target environment available | Met | Where does it run? | Locally (Docker compose profiles) and in GitHub Actions | Owner |
| App change for LLM base URLs | Met | May the provider registry read `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL`? | Yes, defaults unchanged, one commit (plan decision D3) | Owner |
| Stateful backend flows | Met | Which conversation-service flows keep state? | Chats and messages in memory (send, stream, edit, cancel, retry); settings, attachments and members are canned seed data | Owner |
| E2E in CI (AICHAT-153) | Met | How far do we go with the failing e2e workflow? | Make the chat flows pass against the mock; the other failing specs stay with AICHAT-4/5 | Owner |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Express | see `testing/mock-server/package.json` | `pnpm install` |

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
