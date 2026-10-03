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

### US1 · Agree unit-test policy and exempt list ([AICHAT-36](https://ipca-grupo11.atlassian.net/browse/AICHAT-36))

**What and why.** The per-project teams will work in parallel on top of this, so the rule and the list of exceptions have to be
fixed first and in one place. We wrote the policy ("every source file has a co-located unit test unless it is on the exempt
list"), listed every source file of the repository with one script, and wrote the complete exempt list for the whole repository
now, so nobody has to edit it later and the teams do not get merge conflicts on it. Only three categories can be exempt
(bootstrap, barrel `index` files, type-only modules), as decided for the epic.

**Files.**
- `docs/AICHAT-17/UNIT-TEST-POLICY.md` (new): the policy, the source-file rules, the three exempt categories, the list format, who edits it. Linked from the epic README.
- `packages/workspace-config/unit-test-exempt.json` (new): 50 entries, each with `path`, `category` and one `reason`. It sits in `workspace-config` so the guard of AICHAT-138 can read it.
- `scripts/unit-test/source-files.mjs` (new): lists the source files with the rules of README section 4.1, shows which have a test or an entry, and `--check` validates the exempt list (exit 1 on a stale path, a missing reason, an unknown category, or an exempt file that now has a test).
- `docs/AICHAT-17/README.md`: link to the policy and the list.

**How to run.**

```sh
node scripts/unit-test/source-files.mjs --check   # validates the exempt list
node scripts/unit-test/source-files.mjs           # per project: files, own test, exempt, neither
node scripts/unit-test/source-files.mjs --list | grep NO-TEST   # what is left to test
```

**How to repeat it manually.**

1. From the repository root run `node scripts/unit-test/source-files.mjs --check`.
2. Open `packages/workspace-config/unit-test-exempt.json` and pick an entry: its file must exist and have no `*.test.*` / `*.spec.*` next to it.
3. Expected output: `245 source files, 50 exempt entries, 0 problems`, exit code 0. Add a test next to an exempt file and the check fails with "exempt but has its own test".

**Result.** 245 source files: 131 have their own test, 50 are exempt (35 barrels, 14 bootstrap, 1 type-only) and 64 still need a
test. Those 64 are the work of the per-project stories.

![Exempt list check](evidence/01-exempt-list-check.png)

![Inventory by project](evidence/02-inventory-by-project.png)

**Problems and fixes.**
- The discovery in the README says 246 files; the script finds 245. One helper file in `auth-service` was counted there and is a test helper under the rules. The policy states the real number.
- The README expected "category C" (type-only) to hold two contract files. Both export Zod schemas, constants and functions, so they are not type-only and need tests. Only `shell/.../auth-guard/model/session.ts` (two interfaces) is type-only.
- Shell route files were checked one by one: five are pure wiring and exempt; `index.tsx` (redirect) and `login.tsx` (`validateSearch`) have logic and stay on the to-test list.
- `features/login/model.ts` and `features/register/model.ts` only re-export, but they are not `index` files, so they are not exempt. A short test is enough.

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
