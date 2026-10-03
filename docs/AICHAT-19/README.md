---
title: "AICHAT-19 · [Foundations] Visual regression testing"
---

# AICHAT-19 · [Foundations] Visual regression testing

| Field | Value |
|---|---|
| Jira | [AICHAT-19](https://ipca-grupo11.atlassian.net/browse/AICHAT-19) |
| Type / label | Epic / `testing` |
| Owner | JP |
| Status (at discovery) | TODO |
| Depends on | AICHAT-4 (E2E harness, João Delgado); full stack in CI (`e2e.yml`) |
| Layer | Frontend (pixels of key screens) |

## 1. Goal

Catch unintended visual changes on the key screens, in **light and dark** themes, by comparing Playwright
screenshots against committed baselines. A diff fails CI.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** JP (Jira assignee)
- [ ] **Scope agreed:** 9 key screens × light/dark at a desktop viewport (§4.4) confirmed in scope
- [ ] **Tooling agreed:** Playwright `toHaveScreenshot` run in the Playwright Docker image confirmed; font strategy chosen (self-host vs intercept)
- [ ] Target environment available
- [ ] Key screens listed → **§4.3**
- [ ] Fixed fonts and data for stable rendering → **not met today, see §4.2**

**DoD**
- [ ] Runs in CI, passes on `main`, failure blocks the merge
- [ ] Run instructions documented
- [ ] Baselines for each screen in light and dark
- [ ] `toHaveScreenshot` diffs fail CI

## 3. Technologies

| Tool | Version | Role |
|---|---|---|
| Playwright Test | `1.63.0` (`e2e/package.json`) | `expect(page).toHaveScreenshot()`, `page.emulateMedia({ colorScheme })`, `page.route()` to stub data |
| Playwright Docker image `mcr.microsoft.com/playwright:v1.63.0-jammy` | — | Same OS/fonts for local and CI renders, so baselines match |
| GitHub Actions | — | Runs in `.github/workflows/e2e.yml` (or a dedicated `visual.yml`) |
| Self-hosted fonts (`@fontsource/inter`, `@fontsource/jetbrains-mono`) | to add | Removes the Google Fonts network dependency |

Alternatives considered: Chromatic/Storybook snapshots (`packages/ui` already has Storybook, which would cover components rather than screens; a paid SaaS), and Percy / Argos (SaaS). Playwright's built-in comparison is free and already in the stack.

## 4. Discovery: current state

### 4.1 Playwright setup (`e2e/playwright.config.ts`)
- `testDir: ./src/tests`, one project `chromium` (Desktop Chrome), `baseURL = BASE_URL ?? http://localhost:4173`.
- CI sets `BASE_URL=http://localhost:8000` after `docker compose up` (`.github/workflows/e2e.yml`).
- No `webServer` block, no `toHaveScreenshot` settings, screenshots only on failure.
- **No visual tests exist** (no `toHaveScreenshot` anywhere).

### 4.2 Stability blockers
- **Fonts come from Google Fonts** (`apps/shell/index.html`: Inter 400–800, JetBrains Mono 400/600, `display=swap`). Renders depend on the network and on swap timing, so they will be flaky.
- **Dynamic data:** chat titles, timestamps, model replies. Need seeded data via `page.route()` mocks or a seed script, plus `mask` for timestamps.
- **LLM replies** are non-deterministic and need a key: screens with messages must use mocked API responses.
- Animations / caret blink: use `animations: "disabled"` and `caret: "hide"`.

### 4.3 Theme mechanism
- `apps/shell/src/shared/theme/theme.ts` toggles the `dark` class and `color-scheme` on `<html>`, stores `localStorage.theme`, falls back to `prefers-color-scheme`.
- `packages/ui/src/styles/globals.css`: `:root` and `.dark` tokens; Tailwind `darkMode: ['class']`.
- Tests can set the theme via `page.addInitScript(() => localStorage.setItem('theme','dark'))` or `page.emulateMedia({ colorScheme: 'dark' })`.

### 4.4 Key screens (from `apps/shell/src/routes`)

| Screen | Route | Remote | Data needed |
|---|---|---|---|
| Login | `/login` | mfeAuth | none |
| Login with validation error | `/login` | mfeAuth | none |
| Register | `/register` | mfeAuth | none |
| Chat list (empty) | `/chats` | mfeChat | session + empty list |
| Chat list (with chats) | `/chats` | mfeChat | session + 3 seeded chats |
| Chat detail with messages (incl. reasoning + web fetch list) | `/chats/$chatId` | mfeChat | seeded messages |
| New chat dialog | `/chats` | mfeChat | session |
| Settings / API keys | `/settings` | mfeSettings | session |
| Remote failure fallback | any | shell | blocked remote (overlaps AICHAT-8) |

9 screens × 2 themes = **18 baselines** (desktop). Mobile viewport can be added later (responsive testing is unassigned).

## 5. Implementation plan (steps)

1. **Stabilise fonts:** self-host Inter and JetBrains Mono (or, in visual tests only, block `fonts.googleapis.com` and inject a local `@font-face`). Record the choice.
2. Add a Playwright project `visual` (chromium, fixed viewport 1280×800, `deviceScaleFactor: 1`) with `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" }` and `snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}"`.
3. Write fixtures that mock `/auth/me`, `/api/chats`, `/api/chats/:id/messages` with fixed JSON (reuse DTO fixtures from AICHAT-20) and freeze time (`page.clock.install({ time })`).
4. Write `e2e/src/visual/screens.spec.ts`: loop over screens × `["light","dark"]`, set the theme, wait for `networkidle` and fonts (`document.fonts.ready`), then screenshot.
5. Generate baselines **inside the Playwright Docker image** (`docker run ... npx playwright test --project=visual --update-snapshots`) so local and CI match; commit them.
6. CI: run the `visual` project in `e2e.yml` (the stack is already up), upload the diff images as an artifact on failure; the job fails on diff.
7. Document the update workflow (when a UI change is intended: re-run with `--update-snapshots` in Docker, review the PNG diff in the PR).

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-39](https://ipca-grupo11.atlassian.net/browse/AICHAT-39) | AICHAT-19-US1 | As a tester, I want deterministic fonts and data on screen so that screenshots are stable | Fonts load without network; API mocks + frozen clock; 10 runs in a row produce identical images | 3 |
| [AICHAT-56](https://ipca-grupo11.atlassian.net/browse/AICHAT-56) | AICHAT-19-US2 | As a tester, I want a `visual` Playwright project with screenshot settings so that comparison rules are in one place | Project in `playwright.config.ts` with thresholds, path template, viewport | 1 |
| [AICHAT-74](https://ipca-grupo11.atlassian.net/browse/AICHAT-74) | AICHAT-19-US3 | As a designer/reviewer, I want baselines of the 9 key screens in light and dark so that any visual change is visible in the PR | 18 committed PNG baselines produced in the Playwright Docker image | 5 |
| [AICHAT-92](https://ipca-grupo11.atlassian.net/browse/AICHAT-92) | AICHAT-19-US4 | As a team, I want visual diffs to fail CI with the diff images attached so that regressions can't be merged | CI job fails on diff; `test-results` diff PNGs uploaded as an artifact | 2 |
| [AICHAT-110](https://ipca-grupo11.atlassian.net/browse/AICHAT-110) | AICHAT-19-US5 | As a developer, I want documented steps to update baselines so that intended changes are easy | `docs/AICHAT-19/RUNNING.md` with Docker update command and review checklist | 1 |

## 7. Risks and open decisions

- **Self-hosting fonts is an app change** (shell `index.html`/CSS). Alternative: route-intercept the font requests only in tests.
- Baselines must be generated on Linux (CI OS); macOS renders differ. Always use the Docker image.
- Theme toggle lives in the shell; remotes inherit via the `dark` class on `<html>`, so one switch covers all remotes.

## 8. Notes for the report

There is no visual testing today. The main technical risk found is **non-deterministic rendering from Google-hosted
fonts and live data**. The plan uses Playwright's built-in `toHaveScreenshot` (no new SaaS), generates baselines inside
the official Playwright Docker image for reproducibility, and covers 9 screens × 2 themes = 18 baselines.
