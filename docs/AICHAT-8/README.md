---
title: "AICHAT-8 · [Foundations] Remote failure and fallback testing"
---

# AICHAT-8 · [Foundations] Remote failure and fallback testing

| Field | Value |
|---|---|
| Jira | [AICHAT-8](https://ipca-grupo11.atlassian.net/browse/AICHAT-8) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Related | AICHAT-19 (visual regression of the fallback UI), AICHAT-10 (fallback must be accessible) |
| Layer | Frontend, Module Federation (shell + 3 remotes) |

## 1. Goal

When any of the three federated remotes (`mfeAuth`, `mfeChat`, `mfeSettings`) fails or is slow, the shell shows a **scoped
fallback** for that remote only, the **rest of the app keeps working**, and **Retry** recovers it without a page reload.
Each remote is blocked and delayed **in turn** by Playwright, and the suite gates every PR.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** Playwright `page.route` per remote origin; abort, HTTP 500 and delay modes
- [ ] Target environment available (local compose stack and the `e2e.yml` CI stack)
- [x] Error boundary / fallback UI exists in the shell for each remote → **done, see §4.1**

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] Playwright blocks and delays each of the 3 remotes in turn
- [ ] Fallback shown and the other routes still work

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| Playwright | `1.63.0` (`e2e/package.json`) | `page.route` to abort / fulfil 500 / delay remote requests; console event capture |
| Module Federation (`@module-federation/vite`) | in `apps/shell` | Remote loading; `remoteEntry.js` per remote |
| React `lazy` + `Suspense` + error boundary | in `apps/shell` | Loading skeleton and scoped fallback |
| Vitest + Testing Library | `5.0.1` / `^16` | Unit test of the retry path in `createRemoteRoute` |
| GitHub Actions `e2e.yml` | — | Runs the suite against `docker compose up` |

## 4. Discovery: current state

### 4.1 How remotes are loaded

| File | What it does |
|---|---|
| `apps/shell/module-federation.config.ts` | Remotes `mfeAuth`, `mfeChat`, `mfeSettings`, each at `${VITE_MFE_*_URL}/remoteEntry.js` (defaults `localhost:5001-5003`) |
| `apps/shell/src/features/remote-loader/model/loadRemote.ts` | Wraps the dynamic import; any rejection becomes a `RemoteLoadError` tagged with the scope name |
| `apps/shell/src/features/remote-loader/createRemoteRoute.tsx` | `Suspense` (skeleton `data-testid="remote-loading-<scope>"`) + `RemoteErrorBoundary`; Retry bumps `retryKey` to create a fresh `React.lazy` |
| `apps/shell/src/features/remote-loader/components/RemoteErrorBoundary.tsx` | Catches, logs `[remote-loader] remote "<scope>" failed:` and renders `RemoteFallback` |
| `apps/shell/src/features/remote-loader/components/RemoteFallback.tsx` | `Alert` + Retry button |
| `apps/shell/src/routes/{login,register,chats,chats.$chatId,settings}.tsx` | Each route mounts one remote via `createRemoteRoute` |

### 4.2 Existing tests

- `apps/shell/src/features/remote-loader/RemoteErrorBoundary.test.tsx`: unit test of the boundary.
- `e2e/src/tests/shell.spec.ts` → `US-9: Microfrontend failure isolation`: aborts `/remoteEntry|mfe-chat/i`, checks an alert on
  `/chats`, unroutes, then checks `/settings` renders.

### 4.3 Gaps

1. The US-9 route regex matches **every** `remoteEntry.js`, so while it is active the auth and settings remotes are blocked too.
   The test unroutes before checking `/settings`, so it never proves isolation **while** one remote is down.
2. Only the chat remote is tested; auth and settings failures are not.
3. No **delay** test (loading skeleton), no **HTTP 500** test, no **Retry** test.
4. No load timeout: a remote that never answers keeps the skeleton forever (decision needed).
5. No test for a chunk failing **after** `remoteEntry.js` loaded (e.g. redeploy mid-session).

## 5. Implementation plan (steps)

1. `e2e/src/fixtures/remote-faults.ts`: `failRemote(page, remote, mode)` that matches only the remote's origin
   (from the same env vars the shell uses); pure URL matcher unit-tested with Vitest.
2. `e2e/src/tests/remote-failure.spec.ts`: `for (const remote of remotes)` → abort and 500 → fallback visible, NavBar visible,
   other two remotes' routes work **while the fault is active**.
3. Delay mode: skeleton visible, then content, no fallback. Record the decision on a load timeout.
4. Retry: fail → unroute → click Retry → content renders without navigation. Unit test for `createRemoteRoute` retry.
5. Partial failure: allow `remoteEntry.js`, block the exposed chunk; assert fallback and the `[remote-loader]` console line.
6. Replace or refactor the US-9 block to reuse the helper; run in `e2e.yml`; README section in `e2e/README.md`.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-161](https://ipca-grupo11.atlassian.net/browse/AICHAT-161) | AICHAT-8-US1 | As a tester, I want a Playwright helper that fails or delays exactly one remote | `failRemote(page, remote, mode)` with abort/delay/500; matches only that remote's origin; URL matcher unit-tested | 2 |
| [AICHAT-162](https://ipca-grupo11.atlassian.net/browse/AICHAT-162) | AICHAT-8-US2 | As a user, I want a failed remote to show a scoped error while the rest works | Each remote blocked in turn; fallback + NavBar visible; other two remotes work in the same session; abort and 500 covered | 3 |
| [AICHAT-163](https://ipca-grupo11.atlassian.net/browse/AICHAT-163) | AICHAT-8-US3 | As a user on a slow network, I want a loading state while a remote downloads | Skeleton then content per remote; decision recorded for a remote that never answers | 2 |
| [AICHAT-164](https://ipca-grupo11.atlassian.net/browse/AICHAT-164) | AICHAT-8-US4 | As a user, I want Retry to load a failed remote without a page reload | E2E recover via Retry; unit test of `createRemoteRoute` retry; retry while down shows fallback again | 2 |
| [AICHAT-165](https://ipca-grupo11.atlassian.net/browse/AICHAT-165) | AICHAT-8-US5 | As a user, I want partial failures (chunk after remoteEntry) isolated too | Chunk blocked → fallback, no error overlay; mid-session outage asserted; `[remote-loader]` log checked | 3 |
| [AICHAT-166](https://ipca-grupo11.atlassian.net/browse/AICHAT-166) | AICHAT-8-US6 | As a team, I want the suite to gate every PR | `remote-failure.spec.ts`; US-9 reuses the helper; runs in `e2e.yml`; run instructions in `e2e/README.md` | 1 |
| | | **Total** | | **13** |

## 7. Risks and open decisions

- **Load timeout:** add one to `createRemoteRoute` (small app change) or accept an endless skeleton for a hung remote.
- Remote URLs differ between local (`localhost:500x`), compose and the VM; the helper must read them from env, not hard-code.
- Module Federation may cache a loaded container; tests must use a fresh page/context per scenario.

## 8. Notes for the report

The shell already has the right building blocks (scoped error boundary, fallback with Retry, per-remote lazy loading), but the
only existing test blocks every remote at once and only checks the chat route, so per-remote isolation was never actually
proven. The epic turns this into a parameterised suite over the three remotes and three fault modes (abort, 500, delay), adds
the Retry path and partial chunk failures, and makes it a merge gate.
