---
title: "AICHAT-8 · Remote failure and fallback testing: work log"
---

# AICHAT-8 · Remote failure and fallback testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-8](https://ipca-grupo11.atlassian.net/browse/AICHAT-8) |
| Analysis | [README.md](README.md) |
| Owner | João Vieira |
| Branch | `test/AICHAT-8-remote-failure-fallback` (built on `test/AICHAT-13-concurrency`, PR #35 not merged yet) |
| Started / finished | 2026-10-13 / … |
| Pull requests | … |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-13

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | João Vieira | — |
| Scope and tooling agreed | Met | Playwright `page.route` matching only one remote's origin, with abort, HTTP 500 and delay modes, all specs in `e2e/src/tests/remote-failure.spec.ts`? | Agreed as written | João Vieira |
| Target environment available | Met | Local compose stack and the `e2e.yml` CI job? | Both. Locally `pnpm mock:up` (shell on `:8000`, remotes on `:3001`, `:3002`, `:3003`); `e2e.yml` runs on every pull request | João Vieira |
| Error boundary / fallback UI exists for each remote | Met | — | Yes: every route mounts its remote through `createRemoteRoute` (`Suspense` skeleton `remote-loading-<scope>` + `RemoteErrorBoundary` → `RemoteFallback` `remote-fallback-<scope>` with Retry) | — |

Decisions:

| Topic | Decision |
|---|---|
| Remote that never answers | **Add a 15 s load timeout** in the shell. After 15 s the load fails with `RemoteLoadError`, so the fallback with Retry appears instead of an endless skeleton |
| Unit test of the URL matcher | **Browserless Playwright test** in `e2e/src/tests/support/`, the same pattern as `drop-proxy.spec.ts` (AICHAT-9). The `e2e` project has no Vitest; adding it for one file is not worth a new dependency. This replaces "Vitest" in the AICHAT-161 criterion |
| Old US-9 block in `e2e/src/tests/shell.spec.ts` | **Nothing to replace**: commit `5eb6221` (`chore: remove generated tests`) already deleted the file |

Found during the review (changes the plan, not the scope):

- The unit test for Retry asked for by AICHAT-164 already exists: `createRemoteRoute.test.tsx` →
  "keeps failing visibly if the retry fails too, and recovers when a later retry works" checks that the loader runs 3 times.
  AICHAT-164 only adds the E2E part.
- `e2e.yml` runs on `pull_request` and on pushes to `main`, so a failing spec in the suite already fails the check.

Blockers: none.

## 2. Environment

| Tool | Version | Install |
|---|---|---|
| macOS | 27.0 | — |
| Node | v26.8.2 locally (CI uses the version in `e2e.yml`) | nvm / Homebrew |
| pnpm | 10.4.0 (pinned in `package.json`) | `pnpm install --frozen-lockfile` |
| Docker | 29.7.2 | Docker Desktop |
| Playwright | 1.63.0 | workspace dev dependency |

![Versions](evidence/00-environment.png)

## 3. Steps

### US1 · Playwright helper to block or delay a single remote ([AICHAT-161](https://ipca-grupo11.atlassian.net/browse/AICHAT-161))

**What and why.** Every other story needs to break one remote and only that one. We first looked at what the browser
requests: the shell fetches the `remoteEntry.js` of **all three** remotes on every page (the Module Federation runtime
reads them to agree on the shared libraries: React, the router, `@app/ui`), then the chunks of the page being opened.
A pattern such as `/remoteEntry/` therefore blocks every remote at once. Each remote is served from its own origin
(`localhost:3001`, `:3002`, `:3003` in `compose.yaml`), so the helper matches the **origin**.

A first manual check, with one remote aborted at a time, already showed the expected isolation: only the page that
mounts the broken remote shows its fallback, the other two work.

| Remote aborted | `/chats` | `/settings` | `/login` |
|---|---|---|---|
| `mfeAuth` | works | works | `remote-fallback-auth` |
| `mfeChat` | `remote-fallback-chat` | works | works |
| `mfeSettings` | works | `remote-fallback-settings` | works |

`failRemote(page, remote, mode, files)`:

| Argument | Values |
|---|---|
| `remote` | `mfeAuth`, `mfeChat`, `mfeSettings`. The table `remotes` also gives the scope name used in the test ids (`auth`, `chat`, `settings`) and a page that mounts the remote |
| `mode` | `abort` (network error), `http-500`, `{ delayMs }`, `hang` (no answer until `restore()`) |
| `files` | `all` (default) or `chunks`: `remoteEntry.js` still loads, only the chunks fail (used by US5) |

It returns `restore()`, which removes the route and lets any held request through (used by US4).

The origins come from `VITE_MFE_AUTH_URL`, `VITE_MFE_CHAT_URL` and `VITE_MFE_SETTINGS_URL`, the variables the shell is
built with; the defaults are the `compose.yaml` ports.

**Files.**
- `e2e/src/tests/support/remote-faults.ts` (new): `remotes`, `matchesRemote`, `failRemote`.
- `e2e/src/tests/support/remote-faults.spec.ts` (new): unit tests of `matchesRemote`, no browser.

**How to run.**

```sh
cd e2e && pnpm exec playwright test src/tests/support/remote-faults.spec.ts --reporter=list
```

**How to repeat it manually.**

1. In `matchesRemote`, add `if (/remoteEntry|mfe-chat/i.test(String(url))) return true;` as the first line (the old
   US-9 pattern).
2. Run the command above: all 6 tests fail, each naming a file of another remote (or of the shell) that would have
   been blocked.
3. Remove the line: 6 passed.

**Result.** With the old pattern every case fails; with the origin match all pass.

![Old pattern: 6 failures](evidence/01-matcher-old-regex-red.png)

![Origin match: 6 passed](evidence/02-matcher-green.png)

**Problems and fixes.**
- The `e2e` project has no Vitest. As agreed in the DoR, the matcher test is a browserless Playwright test, like
  `drop-proxy.spec.ts`; it runs in the same job as the rest of the suite.
- The shell's own defaults in `module-federation.config.ts` are the dev ports `5001`–`5003`; the stack the suite runs
  against publishes `3001`–`3003`, so the helper defaults to those.
