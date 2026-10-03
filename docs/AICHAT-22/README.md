---
title: "AICHAT-22 · [Foundations] Bundle size budget testing"
---

# AICHAT-22 · [Foundations] Bundle size budget testing

| Field | Value |
|---|---|
| Jira | [AICHAT-22](https://ipca-grupo11.atlassian.net/browse/AICHAT-22) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Related | AICHAT-21 (performance) |
| Layer | Frontend build output (Module Federation) |

## 1. Goal

Each micro-frontend's `remoteEntry.js` and its chunks stay below an agreed size limit. Going over the limit fails CI.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** Shell + 3 remotes confirmed in scope: `remoteEntry.js`, exposed-module chunks, shared fallbacks
- [ ] **Tooling agreed:** size-limit with `@size-limit/file` as an Nx `size` target confirmed
- [ ] Target environment available
- [ ] Size limits agreed per remote → **proposal in §5**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] size-limit checks every `remoteEntry.js` and chunk
- [ ] Going over the limit fails CI

## 3. Technologies

| Tool | Role |
|---|---|
| **size-limit** (`size-limit` + `@size-limit/file`) | Measures built files (gzip or brotli) against limits in `.size-limit.json`; non-zero exit when over |
| `andresz1/size-limit-action` (GitHub Action, optional) | Comments the size diff on the PR |
| `rollup-plugin-visualizer` (optional) | Treemap to explain what grew |
| Vite build | Produces `apps/*/dist/remoteEntry.js` and `dist/assets/*.js` |
| Nx | New `size` target per app, `dependsOn: ["build"]`, run via `nx affected -t size` |

`@size-limit/file` is enough: it measures the files that are already built. `@size-limit/preset-app` would also measure running time with a headless browser, which is not needed here.

## 4. Discovery: current state

- **No size-limit, bundlesize or visualizer config** in the repo.
- Builds go to `dist/` (no custom `outDir`); all apps: `target: esnext`, `modulePreload: false`, `filename: "remoteEntry.js"`.
- Module Federation names: shell `shell` (host); remotes `mfeAuth`, **`mfe_chat`**, `mfeSettings`. ⚠️ The shell expects `mfeChat`. Worth checking with the shell owner (it may work because the shell loads by URL, but the global name differs).
- Shared singletons declared: react, react-dom, `@tanstack/react-router`, `@tanstack/react-query`, `@app/ui` (mfe-settings doesn't share the router).

### Measured sizes (local `dist/` built 2026-10-03)

| App | `remoteEntry.js` | All JS (raw / gzip) | Largest chunk |
|---|---|---|---|
| shell | 18,994 B | 779 KB / 241 KB | `dist-*.js` 266 KB |
| mfe-auth | 18,433 B | 557 KB / 167 KB | react-dom prebuild 208 KB |
| mfe-chat | 18,777 B | 507 KB / 150 KB | react-dom prebuild 208 KB |
| mfe-settings | 18,347 B | 456 KB / 135 KB | react-dom prebuild 208 KB |

**Finding (report-worthy):** each remote emits its own react-dom (208 KB), router (94 KB) and query (48 KB) chunks.
With `singleton: true` these are *fallbacks*: at runtime only the host's copy should load. Size-limit should
therefore separate **"loaded at runtime"** files (remoteEntry + exposed-module chunks) from **shared fallbacks**, or the
budgets will be dominated by chunks the browser never downloads. A Playwright check of the network requests on
`/chats` (loaded chunks) is a cheap way to confirm this; it overlaps the unassigned "Shared dependency testing".

## 5. Proposed limits (to agree, DoR), gzip

| File group | Limit | Current (approx.) |
|---|---|---|
| each `remoteEntry.js` | 8 KB gzip (≈19 KB raw today) | ~6 KB gzip |
| shell entry + own chunks (excl. shared fallbacks) | 120 KB | to measure |
| mfe-auth exposed `./routes` chunk graph | 40 KB | to measure |
| mfe-chat exposed `./routes` chunk graph | 80 KB | to measure |
| mfe-settings exposed `./routes` chunk graph | 40 KB | to measure |
| total JS per app (guard rail, includes fallbacks) | current + 10% | 135–241 KB |

Start with "current + 10%" for everything, then tighten after the first improvements.

## 6. Implementation plan (steps)

1. Add `size-limit` and `@size-limit/file` as root devDependencies.
2. Measure precisely: build all apps and list chunks per app, separating exposed-module chunks from `__federation_shared_*`/prebuild fallbacks (chunk names show this).
3. Write `.size-limit.json` per app (or one at the root with `path` globs such as `apps/mfe-chat/dist/remoteEntry.js`, `apps/mfe-chat/dist/assets/!(*react-dom*)*.js`).
4. Add an Nx target `size` per app: `size-limit --json`, `dependsOn: ["build"]`, cached on `dist/**`.
5. CI: add `size` to `NX_AFFECTED_TARGETS` in `.github/workflows/ci.yml` (`lint typecheck test build size`). Over-limit exits non-zero and fails the job.
6. (Optional) PR comment with the size diff (`size-limit-action`).
7. (Optional) `rollup-plugin-visualizer` behind `ANALYZE=1` to find what to cut.
8. Document: how to read the output, how to raise a limit with a reason in the PR.

## 7. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-47](https://ipca-grupo11.atlassian.net/browse/AICHAT-47) | AICHAT-22-US1 | As a team, I want agreed size limits per remote so that bundle growth is a conscious decision | Limits recorded here with the measured baseline | 1 |
| [AICHAT-65](https://ipca-grupo11.atlassian.net/browse/AICHAT-65) | AICHAT-22-US2 | As a developer, I want `nx run <app>:size` to check every remoteEntry.js and chunk so that I can check locally | size-limit config for shell + 3 remotes; target passes on `main` | 3 |
| [AICHAT-83](https://ipca-grupo11.atlassian.net/browse/AICHAT-83) | AICHAT-22-US3 | As a team, I want CI to fail when a bundle goes over its limit | `size` in `nx affected` targets; a deliberate +50 KB import fails the job | 2 |
| [AICHAT-101](https://ipca-grupo11.atlassian.net/browse/AICHAT-101) | AICHAT-22-US4 | As a reviewer, I want the size change shown on each PR | PR comment or job summary with before/after per file | 2 |
| [AICHAT-119](https://ipca-grupo11.atlassian.net/browse/AICHAT-119) | AICHAT-22-US5 | (Spike) As an architect, I want to confirm shared dependencies load once at runtime so that the budgets measure what users download | Network-request check on `/chats`; result recorded; mismatch reported | 2 |

## 8. Risks and open decisions

- Hashed chunk names change each build; use globs, not file names.
- Federation fallback chunks inflate "total" numbers. Decide whether limits apply to "runtime-loaded" or "all emitted" files (recommendation: both, with a looser total).

## 9. Notes for the report

There is no bundle budget today. Each remote's `remoteEntry.js` is small (~19 KB raw), but every remote also emits
**its own copy of react-dom, the router and React Query** as shared fallbacks. Discovery also found a federation name
mismatch (`mfe_chat` vs the shell's `mfeChat`). The plan uses size-limit with `@size-limit/file`, an Nx `size` target
and `nx affected` in CI, with separate limits for runtime-loaded and fallback chunks.
