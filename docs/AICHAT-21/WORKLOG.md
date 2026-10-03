---
title: "AICHAT-21 · Performance testing (frontend): work log"
---

# AICHAT-21 · Performance testing (frontend): work log

| Field | Value |
|---|---|
| Epic | [AICHAT-21](https://ipca-grupo11.atlassian.net/browse/AICHAT-21) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-21-performance-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which pages? | `/login`, `/register`, `/chats`, `/chats/:id`, `/settings` | Team (owner delegated) |
| Tooling agreed | Met | Lab and field tools? | Lighthouse CI (desktop preset, median of 3 runs) for lab data with TBT as the INP proxy; Grafana Faro (already in the shell) for field LCP/INP/CLS | Team (owner delegated) |
| Target environment available | Met | Where does it run? | The compose stack with the LLM mock (`pnpm mock:up llm`), locally and on the CI runner. The Azure VM is not used by this epic, so the field dashboard is proven with real browser visits on the local stack | Team (owner delegated) |
| Budgets agreed per page | Met | README §5 proposal | Approved as proposed (login/register LCP ≤ 2.0 s, TBT ≤ 200 ms, CLS ≤ 0.05; other pages LCP ≤ 2.5 s, TBT ≤ 300 ms, CLS ≤ 0.1; INP field p75 ≤ 200 ms) | Team (owner delegated) |
| Signed-in pages | Met | How does Lighthouse see them? | A seeded test user signs in before the run; its session cookie is passed to Lighthouse (extra headers), so no browser login script is needed | Team (owner delegated) |
| CI trigger and noise | Met | The full e2e suite left pull requests because it was slow | Own workflow `lighthouse.yml` with the same triggers as DAST: pull requests to `main`, pushes to `integration/testing-epics` and `main`, manual runs. Budgets assert as `error` with median of 3; reports kept as artifacts | Team (owner delegated) |

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
