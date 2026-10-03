---
title: "AICHAT-24 · Load testing: work log"
---

# AICHAT-24 · Load testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-24](https://ipca-grupo11.atlassian.net/browse/AICHAT-24) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-24-load-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | Which scenarios, on which machine? | User and stream scenarios; no production run and no Azure VM (same as plan decision D11): the local compose stack with a resource-limited override that mimics `Standard_B2als_v2` (2 vCPU, 4 GB) | Team (owner delegated) |
| Tooling agreed | Met | Tools, and how do we measure time to first token? | k6 with `xk6-sse` built in Docker (TTFB approximation as fallback), the LLM mock from AICHAT-144, a `docker stats` sampler and Grafana panels | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Locally (Docker compose, profile `llm`); not in CI because a load run takes minutes and needs the whole stack | Team (owner delegated) |
| k6 scenarios | Met | Existing script is broken (§4.1) | Rewritten in TypeScript against the real API flow | Team (owner delegated) |
| Mock LLM | Met | Does it exist? | Yes, delivered by AICHAT-144 | Team (owner delegated) |
| Run length | Met | How long are the runs? | Ramps of a few minutes; the soak scenario is defined for long runs but recorded with a 5-minute run | Team (owner delegated) |
| CPU credits | Met | B-series credits change results | Not applicable locally; the limits are fixed, recorded in the results | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| k6 / xk6-sse | `k6 version` → … | Docker image `grafana/k6`, custom build with `grafana/xk6` |

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
