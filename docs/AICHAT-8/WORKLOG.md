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
| One slow or hung remote holds up the whole shell (found in US3) | **Fix it, test-first**: `shareStrategy: 'loaded-first'` in the shell's federation config, on top of the 15 s timeout. Decided by João Vieira on 2026-10-13, after the DoR |
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

### US2 · Each remote blocked in turn shows its scoped fallback ([AICHAT-162](https://ipca-grupo11.atlassian.net/browse/AICHAT-162))

**What and why.** The promise of the micro-frontend design: when one remote is down, only its part of the page fails.
One parameterised test runs for each remote (`mfeAuth`, `mfeChat`, `mfeSettings`) and each failure (`abort`, `http-500`),
6 cases. Each case signs in, breaks the remote, and then, **with the fault still active**:

1. opens **every page** that mounts the remote (`/login` and `/register` for `mfeAuth`; `/chats` and `/chats/:id`, with
   a chat created through the API, for `mfeChat`; `/settings` for `mfeSettings`): `remote-fallback-<scope>` is visible, has the `alert` role and a Retry button, the remote's
   own content is absent, and the NavBar (`navigation "Main"`) is still there;
2. opens the two other pages, by clicking the NavBar links (client-side navigation, no reload) or, for `/login`, which
   has no link once signed in, with `page.goto`: each one renders its content and no fallback appears anywhere.

`test.step` names each phase, so a failure says which page broke (for example "mfeAuth still works while mfeChat is
down").

**Files.**
- `e2e/src/tests/remote-failure.spec.ts` (new): describe block `AICHAT-162`.
- `e2e/src/tests/support/remote-faults.ts`: `ready`, the test id each remote renders once it has loaded
  (`sign-in`, `new-chat`, `settings-heading`).

**How to run.**

```sh
cd e2e && pnpm exec playwright test src/tests/remote-failure.spec.ts -g AICHAT-162 --reporter=list
```

**How to repeat it manually.**

1. Start the stack (`pnpm mock:up`), open http://localhost:8000 and sign in.
2. DevTools → Network → right-click any request to `localhost:3002` → **Block request domain**.
3. Reload `/chats`: the alert "This section couldn't load" appears under the NavBar.
4. Click **Settings**: the settings page works. Open `/login`: the sign-in form works.
5. Remove the block (Network request blocking panel) and repeat with `localhost:3001` and `localhost:3003`.

**Result.** 6 passed, together with the 6 matcher tests.

![Chat fallback: NavBar and alert with Retry](evidence/06-chat-fallback.png)

![12 passed](evidence/05-isolation-green.png)

To check that the test can fail, we broke the helper in two ways:

| Change | What the test reports |
|---|---|
| The fault spreads to all three remote origins (the shell itself still loads) | the fallback step passes, then **"mfeAuth still works while mfeChat is down"** fails: `sign-in` not found |
| Back to the old US-9 pattern `/remoteEntry\|mfe-chat/i` | the first step fails on a **blank page**: the pattern also matches `http://localhost:8000/remoteEntry.js`, the shell's own entry (the shell is a federation container too), so the whole app stops |

![Fault spreads: the isolation step fails](evidence/04-isolation-red-fault-spreads.png)

![Old pattern: blank page, no fallback](evidence/03-isolation-red-all-remotes-blocked.png)

**Problems and fixes.**
- The second row is a finding about the deleted US-9 test: its pattern broke the shell, not only the chat remote, so it
  could not have proved isolation.
- With all three remotes down (and the shell up), the shell still shows its NavBar and the page's fallback: the runtime
  tolerates a failed `remoteEntry.js` and only the route that needs it fails.

### US3 · Slow remote shows the loading skeleton, then the content ([AICHAT-163](https://ipca-grupo11.atlassian.net/browse/AICHAT-163))

**What and why.** On a slow network the user must see a loading state, never a blank or frozen page; a remote that
never answers must end in the fallback with Retry (DoR decision: a 15 s timeout).

Before writing the test we timed what the browser shows with `mfeChat` slowed down (1 s per file) or never answering:

| Case | First 4 s | Then |
|---|---|---|
| `mfeChat` slow, open `/chats` | blank page | skeleton at 4.2 s, chat at 7.2 s |
| `mfeChat` slow, open **`/settings`** | blank page | settings at 4.2 s, although settings does not use the chat remote |
| `mfeChat` never answers, `/settings` or `/chats` | blank page | **blank forever**, no NavBar |

**Defect: one slow remote delays the whole shell, one hung remote blanks it.** The startup code generated by
`@module-federation/vite` 1.22.1 runs before `main.tsx` renders and does:

```js
await Promise.all(await initRes.initializeSharing('default', { strategy: 'version-first', ... }))
```

With the default share strategy, `version-first`, the runtime downloads the `remoteEntry.js` of **every** remote at
startup to pick the highest version of each shared library, and waits for all of them. A failed entry throws and is
caught (that is why abort and HTTP 500 in US2 were harmless); an entry that never answers is awaited forever. The
timeout in `loadRemote` could not help, because React never got to render.

**Fix.**
1. `apps/shell/module-federation.config.ts`: `shareStrategy: 'loaded-first'`. The shell uses the shared libraries it
   already has and fetches a remote's entry only when one of its routes is opened. Every app is built from this
   monorepo with the same versions, so comparing versions across remotes gained nothing.
2. `apps/shell/src/features/remote-loader/model/loadRemote.ts`: `REMOTE_LOAD_TIMEOUT_MS = 15_000`. `Promise.race`
   between the import and a timer that rejects; the timer is cleared in `finally`, so a remote that loads leaves no timer
   behind. The rejection becomes a `RemoteLoadError` ("no answer after 15000 ms"), so the existing error boundary shows
   the fallback.

**Tests** (each one for the three remotes):

| Test | Checks |
|---|---|
| slow (500 ms per file) | the skeleton `remote-loading-<scope>` and the NavBar are visible together, then the content, no fallback |
| never answers: the other pages | the two other remotes' pages render while this one hangs |
| never answers: its own page | skeleton, then the fallback after the 15 s timeout, skeleton gone |
| unit, `loadRemote.test.ts` | still pending 1 ms before 15 s, rejects at 15 s; a loader that answers in time resolves and leaves no timer (fake timers) |
| unit, `moduleFederationConfig.test.ts` | the host uses `shareStrategy: 'loaded-first'` |

**Files.**
- `apps/shell/module-federation.config.ts`, `apps/shell/src/app/moduleFederationConfig.test.ts`
- `apps/shell/src/features/remote-loader/model/loadRemote.ts`, `loadRemote.test.ts`
- `e2e/src/tests/remote-failure.spec.ts`: describe block `AICHAT-163`.

**How to run.**

```sh
cd apps/shell && pnpm exec vitest run src/app/moduleFederationConfig.test.ts src/features/remote-loader
cd e2e && pnpm exec playwright test src/tests/remote-failure.spec.ts -g AICHAT-163 --reporter=list
```

The E2E tests need a shell image built from this branch (`pnpm mock:up` rebuilds it).

**How to repeat it manually.**

1. With the stack up, sign in at http://localhost:8000.
2. DevTools → Network → throttling **Slow 3G**, open `/settings`: the skeleton appears under the NavBar, then the page.
3. To make a remote hang: `docker pause llm-chat-mfe-chat-1`. Docker's port proxy still accepts the connection, but
   nothing answers (`curl --max-time 4 http://localhost:3002/remoteEntry.js` gives up after 4 s).
4. Reload `/settings`: it opens at once. Open `/chats`: skeleton, then after 15 s "This section couldn't load". On the
   old shell both pages stayed blank.
5. `docker unpause llm-chat-mfe-chat-1` and click **Retry**.

**Result.** Test-first: the 6 "never answers" cases failed on the old shell (blank page), the 3 slow cases passed (the
page appeared, only late). The 4 new unit tests failed before the change. After the change and a rebuild of the shell
image all pass.

![Before: the 6 hang cases fail](evidence/07-hung-remote-red.png)

![Before: mfeAuth never answers and /chats stays blank](evidence/08-hung-remote-blank-app.png)

![Unit tests before the change](evidence/09-shell-unit-red.png)

![Unit tests after the change](evidence/10-shell-unit-green.png)

![After: skeleton under the NavBar while mfeChat hangs](evidence/11-hung-remote-skeleton.png)

![After: 9 passed](evidence/12-hung-remote-green.png)

**Problems and fixes.**
- The first slow test used 1.5 s per file. A remote loads a chain of about six files, so loading took ~10 s, close to the
  15 s timeout: on a slower CI runner the test could have turned into a timeout. 500 ms per file still shows the
  skeleton for several seconds and loads in ~3 s.
- To check that `loaded-first` breaks nothing else, we ran the login, registration, chat management and API key specs
  against the new shell: 50 passed, 1 skipped. The 2 failures (and 24 in a first run) were the auth-service rate limit
  (300 requests per 15 minutes, `429` in its log); both passed after `docker restart llm-chat-auth-service-1`. CI turns
  the limit off with `AUTH_RATE_LIMIT_MAX=0`.
