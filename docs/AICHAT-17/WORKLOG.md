---
title: "AICHAT-17 · Unit testing: work log"
---

# AICHAT-17 · Unit testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-17](https://ipca-grupo11.atlassian.net/browse/AICHAT-17) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-17-unit-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Whole repo or only hooks, utils and capability tables? | Whole repo: every source file in `apps/*/src`, `packages/*`, `services/*/src` and `e2e/src`; exempt only bootstrap files, barrel `index` files and type-only modules, one reason each in `unit-test-exempt.json` (plan decision D2). Jira epic text updated | Owner |
| Tooling agreed | Met | Vitest + Testing Library + supertest; MSW or hand-written `fetch` stubs? | Vitest, Testing Library (`render`, `renderHook`), supertest; **MSW adopted**: handlers for auth, chats, messages and settings replace the hand-written stubs | Owner |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions (`nx affected -t test`); the e2e suite is not run for this epic (too slow, now manual-only) | Owner |
| Capability parity (AICHAT-133) | Met | Test reads both tables, or one shared table? | Move the model capability table to `packages/shared-types`, used by both mfe-chat and conversation-service | Owner |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Vitest / MSW | see `package.json` of each project | `pnpm install` |

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
