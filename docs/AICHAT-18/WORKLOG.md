---
title: "AICHAT-18 · Component testing: work log"
---

# AICHAT-18 · Component testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-18](https://ipca-grupo11.atlassian.net/browse/AICHAT-18) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-18-component-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which components and states? | Composer, ChatView and ProviderList with the state matrix of README §4 | Team (owner delegated) |
| Tooling agreed | Met | Tools, and is `vitest-axe` adopted? | Vitest, Testing Library, user-event, MSW and the shared fake `EventSource` from `@platform/test-utils` (extended with `emit`, `error`, `close`); `vitest-axe` adopted for one assertion per component state | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions (`nx affected -t test`); e2e not run | Team (owner delegated) |
| Testing Library set up | Met | Already in every app? | Yes (and the shared helpers from AICHAT-17) | Team (owner delegated) |
| States listed per component | Met | Where? | README §4 | Team (owner delegated) |
| Flaky streaming tests | Met | How do we wait for streamed tokens? | `findBy*` queries or `vi.useFakeTimers()`, never sleeps | Team (owner delegated) |
| Dead code in ProviderList | Met | Test the keyless Local branch? | No: it cannot be reached; reported to the configuration owner as a ticket | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Vitest / Testing Library / vitest-axe | see `apps/*/package.json` | `pnpm install` |

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
