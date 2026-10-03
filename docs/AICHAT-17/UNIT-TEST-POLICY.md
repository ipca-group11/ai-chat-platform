---
title: "AICHAT-17 · Unit-test policy"
---

# Unit-test policy

Story: [AICHAT-36](https://ipca-grupo11.atlassian.net/browse/AICHAT-36) · Epic: [AICHAT-17](https://ipca-grupo11.atlassian.net/browse/AICHAT-17) ([README](README.md), [work log](WORKLOG.md))

| Field | Value |
|---|---|
| Status | Agreed with the owner on 2026-10-03; open for team review in the epic pull request |
| Applies to | Every source file in `apps/*/src`, `packages/*`, `services/*/src` and `e2e/src` |
| Exempt list | [`packages/workspace-config/unit-test-exempt.json`](../../packages/workspace-config/unit-test-exempt.json) |
| Inventory tool | `node scripts/unit-test/source-files.mjs` |

## 1. The rule

> Every source file has a unit test next to it, unless it is on `unit-test-exempt.json`.

- "Next to it" means the same folder and the same base name: `useLogin.ts` is tested by `useLogin.test.ts`
  (`.spec.ts` / `.spec.tsx` are accepted too, keep the style of the project you are in).
- A test imports the file and checks its behaviour. A test that only imports the file to turn the guard green does not count;
  the coverage thresholds of [AICHAT-34](../AICHAT-34/README.md) and review catch those.
- Tests run in isolation: no network, no database, no real timers when a fake one is enough. HTTP is mocked with MSW
  (see section 5), not with a hand-written `fetch` stub.

## 2. What counts as a source file

Tracked `.ts`, `.tsx` and `.js` files under `apps/*/src`, `packages/*`, `services/*/src` and `e2e/src`, except:

| Not a source file | Examples |
|---|---|
| Tests | `*.test.ts(x)`, `*.spec.ts(x)`, `*.test.js` |
| Declarations and stories | `*.d.ts`, `*.stories.tsx`, `.storybook/` |
| Generated code | `routeTree.gen.ts`, `@mf-types/`, `generated/` (Prisma client) |
| Tool configs | `vitest.config`, `vite.config`, `eslint.config`, `tailwind.config`, `postcss.config` |
| Test helpers | folders `test/` and `test-utils/`, `test-setup.ts`, `test-fakes.ts`, `setup*.ts`, `packages/test-utils`, `packages/workspace-config/src/repo.js` |

The exact rules are in `scripts/unit-test/source-files.mjs`; the guard of [AICHAT-138](https://ipca-grupo11.atlassian.net/browse/AICHAT-138)
reuses them. Today that is 245 files (the discovery count of 246 in the README had one more helper in `auth-service`).

## 3. What can be exempt

Only three categories, as decided for the epic (plan decision D2). Nothing else is exempt, however hard it is to test.

| Category | Meaning | Not this |
|---|---|---|
| `bootstrap` | Process or browser entry points and Module Federation entries that only wire things together and start something real: `main.tsx`, `App.tsx`, `remote-entry.tsx`, `server.ts`, the Prisma client singleton, declarative route files. Covered by the e2e suite. | A file with a branch, a parser or a transformation, even if it sits next to an entry point. |
| `barrel` | An `index.ts` (or a single `export { default } from` entry) that only re-exports. | A module that re-exports and also adds a function or a constant. |
| `type-only` | A module with only types and interfaces: nothing exists at run time. | A module with a Zod schema, an `enum`, a constant or a class. Those are tested. |

Decided while building the list (inventory in section 4):

- All `shared/contracts/*.ts` files of the services and `shared/types.ts` of `mfe-chat` export Zod schemas, constants or
  functions, so they are **not** type-only. They get tests (this also closes the "category C" question of the README).
- Route files in the shell were checked one by one. `__root.tsx`, `chats.tsx`, `chats.$chatId.tsx`, `register.tsx` and `settings.tsx`
  only compose `RequireAuth`, `createRemoteRoute` and the layout, which have their own tests, so they are `bootstrap`.
  `index.tsx` (redirect to `/chats`) and `login.tsx` (`validateSearch`) have logic and need a test.
- `features/login/model.ts` and `features/register/model.ts` in `mfe-auth` re-export a schema but are not `index` files, so
  they are not exempt; a short test is enough.

## 4. The exempt list

File: `packages/workspace-config/unit-test-exempt.json`. It lives in `workspace-config` because the guard test of
[AICHAT-138](https://ipca-grupo11.atlassian.net/browse/AICHAT-138) is in that package and already reads files of the repository.

```json
{
  "version": 1,
  "entries": [
    {
      "path": "apps/shell/src/main.tsx",
      "category": "bootstrap",
      "reason": "Browser entry: calls initFaro and initTheme, then renders App into #root. ..."
    }
  ]
}
```

| Field | Rule |
|---|---|
| `path` | Repository-relative path with forward slashes. It must be a source file (section 2) and it must exist. |
| `category` | One of `bootstrap`, `barrel`, `type-only`. |
| `reason` | One sentence saying why this file cannot or need not have a unit test. Required, at least 10 characters. |

Checks (`node scripts/unit-test/source-files.mjs --check`, exit 1 on any problem): unique paths, valid category, a reason,
the file exists and is in scope, and the file has **no** test of its own (an exempt file that gets a test must leave the list).

Today: 245 source files, 131 with their own test, 50 exempt (35 barrels, 14 bootstrap, 1 type-only), 64 still without a test.
Those 64 are the work of the per-project stories (`node scripts/unit-test/source-files.mjs --list | grep NO-TEST`).

**Who edits it.** The complete list was written once, for the whole repository, so the per-project stories do not touch it.
That avoids merge conflicts between teams working in parallel. If a project needs a new entry (for example a new `main.tsx`),
add it in the same pull request as the file, with a reason, and say so in the description so the reviewer looks at it.

## 5. Shared test helpers and HTTP mocking

Defined in AICHAT-51 and AICHAT-135 and documented in [`packages/test-utils/README.md`](../../packages/test-utils/README.md):

- `renderWithClient`, `renderHookWithClient` and `FakeEventSource` from `@platform/test-utils`.
- MSW handlers for auth, chats, messages and settings from `@platform/test-utils/msw`, started by the setup file
  `@platform/test-utils/setup` with `onUnhandledRequest: "error"`, so a test that makes a request nobody described fails.
- Backend tests keep using the fakes in `services/conversation-service/src/test-utils/` (repositories, storage, recorded provider responses).

## 6. Review and approval

| Step | Who | When |
|---|---|---|
| Rule and categories | Owner (decision recorded in the work log, section 1) | 2026-10-03 |
| Complete exempt list | Owner, with the pull request of this foundation work | 2026-10-03 |
| Team review | Team, on the epic pull request into `integration/testing-epics` | Before the epic is merged |
| Change after that | Any member, by pull request that edits this file and says why | Any time |
