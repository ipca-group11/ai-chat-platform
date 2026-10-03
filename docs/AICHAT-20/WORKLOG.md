---
title: "AICHAT-20 · Snapshot testing: work log"
---

# AICHAT-20 · Snapshot testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-20](https://ipca-grupo11.atlassian.net/browse/AICHAT-20) |
| Analysis | [README.md](README.md) |
| Owner | Jean-Pierre Carvalho |
| Branch | `test/AICHAT-20-snapshot-testing` |
| Started / finished | 2026-10-03 / … |
| Pull requests | #… |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-03

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | Jean-Pierre Carvalho | — |
| Scope agreed | Met | What do we snapshot? | Only the DTOs and wire outputs of README §4.2 (shared-types schemas, SSE frames, error bodies); never component trees | Team (owner delegated) |
| Tooling agreed | Met | Which tools? | Vitest inline and file snapshots, a serializer that normalises UUIDs and dates, and the `vitest/no-large-snapshots` lint rule plus a rule against snapshots in `.tsx` tests | Team (owner delegated) |
| Target environment available | Met | Where does it run? | Locally and in GitHub Actions (`nx affected -t test lint`); e2e not run | Team (owner delegated) |
| DTOs listed | Met | Which schemas? | README §4.2 | Team (owner delegated) |
| Reviewing snapshot changes | Met | How do we stop blind `-u` updates? | The PR template asks "Why did this snapshot change?" | Team (owner delegated) |
| Overlap with Pact (AICHAT-11) and schema validation (AICHAT-12) | Met | Do we duplicate them? | No: snapshots check shape stability only | Team (owner delegated) |

Blockers: none

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS / Ubuntu | … | — |
| Node | `node -v` → … | … |
| pnpm | `pnpm -v` → … | `corepack enable` |
| Docker | `docker --version` → … | … |
| Vitest / eslint-plugin-vitest | see `package.json` | `pnpm install` |

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
