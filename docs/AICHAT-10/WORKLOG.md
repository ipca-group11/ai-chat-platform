---
title: "AICHAT-10 · Accessibility testing: work log"
---

# AICHAT-10 · Accessibility testing: work log

| Field | Value |
|---|---|
| Epic | [AICHAT-10](https://ipca-grupo11.atlassian.net/browse/AICHAT-10) |
| Analysis | [README.md](README.md) |
| Owner | João Vieira |
| Branch | `test/AICHAT-10-accessibility` |
| Started / finished | 2026-10-13 / … |
| Pull requests | … |
| Status | In Progress |

## 1. DoR review

Date: 2026-10-13

| DoR item | Status | Question asked | Decision | Decided by |
|---|---|---|---|---|
| Owner assigned | Met | — | João Vieira | — |
| Scope and tooling agreed | Met | What counts as a failing result? | axe-core through `@axe-core/playwright`, rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. Impacts `serious` and `critical` fail the test; `moderate` and `minor` are kept in the JSON report only | João Vieira |
| Target environment available | Met | — | Compose stack with the `llm` profile (`pnpm mock:up`); `e2e.yml` runs the Playwright suite on every pull request | — |
| Pages and themes to check listed | Met | Which pages, states and themes? | The full matrix of README §4.2, each state in light and dark (see US1) | João Vieira |
| `@axe-core/playwright` installed | Met | — | `^4.10.1` in `e2e/package.json` | — |
| Streaming reply | Decided | How to scan a reply that changes every few ms? | Scan after the stream ends; the live region itself is checked in US4 | João Vieira |
| vitest-axe spike (US5) | Decided | Run the spike or not? | Close as covered by AICHAT-18-US5 (`mfe-chat`, `mfe-settings`) and add the missing checks to `packages/ui` (Button, Input, Dialog, Alert, Select) | João Vieira |

Blockers: none.

Finding at the start: the analysis (README §4.1) points at `e2e/src/a11y/axe-helper.ts`, but that file, its unit tests and
the e2e fixtures were removed on 2026-10-04 in commit `5eb6221` ("chore: remove generated tests"). The dependency stayed,
so no page of the application was scanned for accessibility. US2 restores the helper.

## 2. Environment

![Environment](evidence/00-environment.png)

| Tool | Version | Install |
|---|---|---|
| macOS | 27.0 | — |
| Node | 26.8 (evidence) / 26.10 (shell) | `nvm use`; Node 24.21 of `.nvmrc` is not installed on this machine |
| pnpm | 10.4 (evidence) / 12.6 (shell) | `corepack enable` |
| Docker | 29.7.2 | Docker Desktop |
| `@axe-core/playwright` | 4.10.x | `e2e/package.json` |
| Playwright | 1.63.0 | `pnpm --filter e2e exec playwright install chromium` |

## 3. Steps

### US1 · List the pages, states and themes to audit ([AICHAT-172](https://ipca-grupo11.atlassian.net/browse/AICHAT-172))

**What and why.** An automated scan only covers what it renders. axe-core checks the DOM that exists at the moment it runs:
an error message that is not on screen, a closed dialog or a failed reply that was never produced are not checked. So we
listed every UI state worth scanning, and how a test reaches it, before writing the scan.

**Standard and blocking impacts.** Target: **WCAG 2.2 level AA**. axe-core gives each violation an impact (`minor`,
`moderate`, `serious`, `critical`). `serious` and `critical` block the merge; the others are reported in the JSON
attached to the test. axe-core keeps `critical` for a small group of rules (for example a form field without a label), so
blocking only on `critical` would let missing contrast (`serious`) through.

**Themes.** The shell keeps the user's choice in `localStorage["theme"]` and applies it as the `dark` class on `<html>`
(`apps/shell/src/shared/theme/theme.ts`). Every state is scanned twice: with `theme = light` and with `theme = dark`, set
before the page loads. The test checks the class on `<html>` before scanning, so a "dark" run can never scan the light
page by mistake. Colour contrast is the rule most likely to differ between the two.

**Matrix (17 states × 2 themes = 34 scans).**

| # | Route | State | How the test reaches it |
|---|---|---|---|
| 1 | `/login` | empty form | open the page signed out |
| 2 | `/login` | wrong password | submit a registered email with a wrong password → `login-error` alert |
| 3 | `/register` | empty form | open the page signed out |
| 4 | `/register` | field errors | submit an invalid email and a short password → `email-error`, `password-error` |
| 5 | `/register` | server error | submit an email that already exists → `register-error` alert (409) |
| 6 | `/chats` | no chats | new account |
| 7 | `/chats` | with chats | two chats created through the API |
| 8 | `/chats` | "New chat" dialog open | click `new-chat` |
| 9 | `/chats/:id` | history (reply finished) | send a message, wait until `generating` is gone |
| 10 | `/chats/:id` | stopped reply | `@long` model, click Stop → "Stopped" label |
| 11 | `/chats/:id` | failed reply | `@error-500` model → `message-error-title` |
| 12 | `/chats/:id` | attachments | a pending file in the composer and a sent message with a file |
| 13 | `/chats/:id` | members dialog open | click "Share" |
| 14 | `/chats/:id` | chat not found | open a random id → `chat-error-heading` |
| 15 | `/settings` | no keys | new account |
| 16 | `/settings` | key saved, empty key error, connection test failed | save an Anthropic key; save an empty OpenAI key; test an invalid OpenAI key |
| 17 | `/chats` | remote fallback | `failRemote(page, "mfeChat", "abort")` (AICHAT-8) → `RemoteFallback` alert |

States of the analysis draft that are not in the matrix:

| State | Why |
|---|---|
| Streaming (while tokens arrive) | Decision in §1: the text changes every few milliseconds, so the scan runs after the stream ends (rows 9 and 10). The live region (`role="status"`) is checked in US4 |
| Queued messages | `MessageList` filters `status = queued` out and no component renders the queue (`selectQueuedMessages` is exported but not used). There is nothing on screen to scan |
| Settings "add/test key dialog" | There is no dialog: keys are added and tested in an inline form, covered by rows 15 and 16 |
| Fallback of `mfeAuth` and `mfeSettings` | The shell renders the same `RemoteFallback` component for every remote; one scan covers the markup |

**How to repeat it manually.**

1. Open `apps/shell/src/shared/theme/theme.ts` and confirm the `theme` key and the `dark` class.
2. In the running app (http://localhost:8000), open the console and run `localStorage.setItem("theme", "dark"); location.reload()`.
3. Expected: the page is dark and `document.documentElement.classList.contains("dark")` returns `true`.

**Result.** Matrix agreed with the owner on 2026-10-13 (decision in §1). It is the input of US2: the scan iterates over
these 17 rows.

**Problems and fixes.** None.

### US2 · axe-core scan of every page in light and dark theme ([AICHAT-173](https://ipca-grupo11.atlassian.net/browse/AICHAT-173))

**What and why.** A Playwright test opens each state of the US1 matrix in a real browser against the whole stack,
stores the theme before the page loads, checks the `dark` class on `<html>` and runs axe-core on the page. axe-core reads
the rendered DOM and the computed styles: names of buttons and fields, roles, ARIA attributes, heading order and the
contrast between each text and the colour behind it.

The helper named in the analysis (`e2e/src/a11y/axe-helper.ts`) had been removed in `5eb6221`, so we wrote it again in
`e2e/src/tests/support/` next to the other test helpers, with three changes:

| Change | Why |
|---|---|
| `withTags(wcag2a … wcag22aa)` | Without tags axe also runs its "best-practice" rules, which are not part of WCAG 2.2 AA (decision in §1) |
| Waits for finite CSS animations before scanning | Dialogs fade in; axe measures contrast with the opacity of that moment, so a half-visible dialog gives false results |
| Saves the full result as JSON (`e2e/axe-report/<label>.json`) and attaches it to the test | The `moderate` and `minor` findings, and the rules that passed, stay visible on a green run |

**Files.**
- `e2e/src/tests/support/axe.ts` (new): `assertNoCriticalA11yViolations(page, testInfo, label)`, the impact filter, the
  message format, the JSON report and `summarizeScans` (Markdown table of a set of reports).
- `e2e/src/tests/support/axe.spec.ts` (new): 8 Node-only tests of those decisions (no browser, no stack).
- `e2e/src/tests/accessibility.spec.ts` (new): the 17 states × 2 themes = 34 tests.
- `e2e/src/tests/support/axe-summary-cli.ts` (new, with `axe-summary-cli.spec.ts`) and the `axe-summary` script in
  `e2e/package.json`: prints the table.
- `.github/workflows/e2e.yml`: the table goes to the job summary and `e2e/axe-report` is uploaded as the `axe-report`
  artifact on every run (`if: always()`). The spec is in `e2e/src/tests`, so the existing "Run Playwright E2E suite" step
  runs it and a violation fails the `e2e` job.
- `e2e/.gitignore`: `axe-report/`.

**How to run.**

```sh
pnpm mock:up
cd e2e
pnpm exec playwright test src/tests/support/axe.spec.ts                                   # helper only, no stack
ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test src/tests/accessibility.spec.ts   # ~2 min, 34 scans
pnpm run --silent axe-summary                                                             # table of the last run
```

**How to repeat it manually.**

1. Run one state: `pnpm exec playwright test src/tests/accessibility.spec.ts -g "register · field errors · dark"`.
2. Open `e2e/axe-report/register-field-errors-dark.json`: `violations` has the failing rules, each `nodes[].any[0].data`
   has the two colours and the ratio; `passes` lists the rules that were checked and passed.
3. In the browser: install the axe DevTools extension, open http://localhost:8000/register in dark theme, submit an
   invalid email and run "Scan all of my page": the same `color-contrast` finding appears.

**Result.** The helper's own tests pass (8/8):

![Helper tests](evidence/01-axe-helper-unit.png)

First run of the scan (baseline, before any fix): **19 passed, 15 failed**, exit code 1. Every failure is the same rule,
`color-contrast` (impact `serious`), on 25 elements. No missing names, labels or roles were found.

![Baseline scan](evidence/02-baseline-scan-fails.png)

![Baseline summary](evidence/03-baseline-summary.png)

A failing scan names the state, the impact, the rule and the elements:

![Failure message](evidence/04-failure-message.png)

**Problems and fixes.**
- **Attachment upload returns 404.** The client posts to `/chats/:chatId/attachments`; conversation-service only has
  `/chats/:chatId/messages/:messageId/attachments`. It is the cause of the 9 `attach-file.spec.ts` failures recorded in
  AICHAT-8 and is already tracked as [AICHAT-255](https://ipca-grupo11.atlassian.net/browse/AICHAT-255) (found by the
  contract tests). Decision of the owner: the "attachments" state scans what can be reached today (a file rejected by
  type and a file rejected by the server, both with their error alert); the "sent message with a file" state is added
  when AICHAT-255 is fixed. AICHAT-255 is linked to AICHAT-173.
- **The members dialog is named "Members", not "Chat members".** `DialogContent` gets `aria-label="Chat members"`, but
  the dialog library also sets `aria-labelledby` to the `<h2>`, and `aria-labelledby` wins in the accessible name
  computation. The name is correct; the test now looks for "Members". The `aria-label` has no effect.
- **What the WCAG tags leave out.** axe's `aria-dialog-name` and `region` rules are tagged `best-practice`, so they are
  outside the agreed scope. The keyboard and screen-reader checks of US4 cover the dialogs by hand.

### US3 · Fix the accessibility violations found by the scan ([AICHAT-174](https://ipca-grupo11.atlassian.net/browse/AICHAT-174))

**What and why.** The baseline had one rule failing, `color-contrast`, on 25 elements in 15 scans. Grouping the
elements by colour pair (instead of by page) showed that every one of them came from three design tokens of
`packages/ui`, so the fix is in the tokens and not in 15 pages.

**Triage (baseline of US2).**

| Rule | Impact | Page · state | Theme | Colours (ratio, needs 4.5:1) | Source | Owner |
|---|---|---|---|---|---|---|
| color-contrast | serious | register · field errors; chat · failed reply, not found; chats · remote fallback; settings · errors | light | `#ef4444` on `#ffffff` (3.76) | `--destructive` as text (`FormField` error, `Alert` destructive) | `packages/ui` |
| color-contrast | serious | the same five states | dark | `#7f1d1d` on `#0e0e11` (1.92) | `--destructive` as text | `packages/ui` |
| color-contrast | serious | chat · attachments (error in the list) | light / dark | `#ef4444` on `#fafafa` (3.60) / `#7f1d1d` on `#18181b` (1.76) | `--destructive` as text | `packages/ui` |
| color-contrast | serious | settings · saved key ("Configured" badge) | light / dark | `#fafafa` on `#21c45d` (2.20) / on `#1a9948` (3.53) | `--success-foreground` on `--success` (`Badge`) | `packages/ui` |
| color-contrast | serious | chat · history, stopped, failed, attachments, members (selected chat row, model name) | light | `#71717a` on `#f4f4f5` (4.39) | `--muted-foreground` on `--muted` | `packages/ui` |

No rule was disabled and no selector was excluded, so no follow-up issue for a waiver is needed.

**Why one value per token was not enough.** `--destructive` and `--success` have two jobs: they are the **text** colour
of `Alert` and of the field errors (drawn on the page or card), and the **background** of `Button`, `Badge` and `Toast`
(with `--*-foreground` text on top). In the dark theme the old red was dark, which works as a background under white text
but not as text on a dark page. The new dark values are a light red and a light green, and the text drawn on them
(`--*-foreground`) is now dark.

| Token | Light (before → after) | Dark (before → after) |
|---|---|---|
| `--destructive` | `0 84.2% 60.2%` (`#ef4444`) → `0 73.7% 41.8%` (`#b91c1c`) | `0 62.8% 30.6%` (`#7f1d1d`) → `0 91% 71%` (`#f87272`) |
| `--destructive-foreground` | unchanged (`#fafafa`) | `#fafafa` → `240 10% 3.9%` (dark) |
| `--success` | `142 71% 45%` (`#21c45d`) → `142 72% 29%` (`#157f3c`) | `142 71% 35%` → `142 69% 58%` (`#4ade80`) |
| `--success-foreground` | unchanged | `#fafafa` → `240 10% 3.9%` (dark) |
| `--muted-foreground` | `240 3.8% 46.1%` (`#71717a`) → `240 3.8% 43%` (`#696972`) | unchanged (already 4.5:1) |

**A check at the source.** The browser scan only sees the states it opens. We added a test to
`packages/ui/src/design-tokens.test.ts` that reads `globals.css`, converts every token from HSL to RGB and computes the
WCAG contrast ratio of the 11 text/surface pairs the components use, in both themes (22 cases). It was written first and
failed with the old tokens (**9 failures**, the same ratios axe reported), then passed with the new ones. It also found
a pair the scan never reached: white text on the destructive button, 3.61:1 in the light theme, because no scanned state
shows a destructive button.

**Files.**
- `packages/ui/src/styles/globals.css`: the five token values above, with a comment.
- `packages/ui/src/design-tokens.test.ts`: the contrast test (22 cases, milliseconds, no browser).

**How to run.**

```sh
cd packages/ui && pnpm exec vitest run src/design-tokens.test.ts                 # token contrast, no stack
pnpm mock:up                                                                     # rebuild the images with the new tokens
cd e2e && ANTHROPIC_API_KEY=mock-key-not-a-secret pnpm exec playwright test src/tests/accessibility.spec.ts
```

**How to repeat it manually.**

1. Change `--destructive` in the `.dark` block back to `0 62.8% 30.6%` and run the token test: 2 dark cases fail with
   `dark --destructive on --background is 1.99:1`.
2. Open http://localhost:8000/register in the dark theme and submit an invalid email: the error text is readable
   (screenshots below). With the browser's DevTools, inspect the error and look at "Contrast" in the colour picker.

**Result.** Token test: 9 failed before, 25 passed after.

![Token contrast before](evidence/05-token-contrast-red.png)

![Token contrast after](evidence/06-token-contrast-green.png)

Scan after rebuilding the images: **34 passed**, and the reports have **no violation of any impact** (not only no
blocking one).

![Scan after the fix](evidence/07-scan-after-fix.png)

![Summary after the fix](evidence/08-summary-after-fix.png)

![Register errors, light](evidence/09-register-errors-light.png)

![Register errors, dark](evidence/09-register-errors-dark.png)

**Problems and fixes.**
- `pnpm mock:up` ends with exit code 1 because the one-shot `ollama-pull` container exits; every other container is
  healthy. The images are rebuilt, so the result is not affected.
- `workspace-config:test` fails on this branch and on its base (`test/AICHAT-8-remote-failure-fallback`) with the same
  10 source files without a unit test (e2e support files and the OpenAPI/contract files of the services) and the
  coverage guard missing `e2e`. None of them comes from this epic; the one new file of the epic (`axe-summary-cli.ts`)
  has its own test.
