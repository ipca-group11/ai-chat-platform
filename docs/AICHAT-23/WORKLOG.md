---
title: "AICHAT-23 · Integration testing: work log"
---

# AICHAT-23 · Integration testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-23](https://ipca-grupo11.atlassian.net/browse/AICHAT-23) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-23-integration-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which routes? | The 24 routes of README §4.2 and their error paths, in conversation-service and auth-service | Team (owner delegated) |
| Tooling agreed | Met | Tools, and how are fakes injected? | Vitest + supertest + in-memory fakes; `createApp` accepts overrides (small testability change allowed by plan decision D3, one commit) | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions, in process, no database or network | Team (owner delegated) |
| Fake repositories per service | Met | conversation-service has fakes, auth-service not | We add in-memory fakes for auth-service in this epic | Team (owner delegated) |
| Authorization / IDOR overlap | Met | How far do we test cross-user access? | One cross-user case per route here; the full matrix belongs to a dedicated IDOR epic | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Vitest / supertest | see `services/*/package.json` | `pnpm install` |

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
