---
title: "AICHAT-10 · [Foundations] Accessibility testing"
---

# AICHAT-10 · [Foundations] Accessibility testing

| Field | Value |
|---|---|
| Jira | [AICHAT-10](https://ipca-grupo11.atlassian.net/browse/AICHAT-10) |
| Type / label | Epic / `testing` |
| Owner | João Vieira |
| Status (at discovery) | TODO |
| Related | AICHAT-18 (component tests), AICHAT-19 (visual regression, same page × theme matrix) |
| Layer | Frontend: shell + 3 MFEs + `packages/ui` |

## 1. Goal

Every page, in **light and dark** theme, is scanned with **axe-core** on every PR with **zero serious/critical violations**,
the main flows work **with the keyboard only**, and streaming replies are announced sensibly to screen readers.

## 2. Definition of Ready / Done (from Jira)

**DoR**
- [x] **Owner assigned:** João Vieira (Jira assignee)
- [ ] **Scope and tooling agreed:** axe-core via Playwright; WCAG 2.2 AA tags; serious + critical are blocking
- [ ] Target environment available (compose stack, `e2e.yml`)
- [ ] **Pages and themes to check listed** → draft in §4.2, agreed in US1
- [x] **`@axe-core/playwright` installed** → `^4.10.1` in `e2e/package.json`

**DoD**
- [ ] Tests run in CI and pass on `main`
- [ ] Failure blocks the merge
- [ ] Run instructions added to the project README or `docs/`
- [ ] axe-core runs on every page, light and dark
- [ ] Zero serious/critical violations

## 3. Technologies

| Tool | Version in repo | Role |
|---|---|---|
| `@axe-core/playwright` | `^4.10.1` | Page scans (`AxeBuilder`) |
| Playwright | `1.63.0` | Navigation, theme toggle, keyboard (`page.keyboard`), focus checks |
| `e2e/src/a11y/axe-helper.ts` | in repo | `assertNoCriticalA11yViolations`, `filterBlockingViolations`, `formatViolations` |
| `vitest-axe` (optional, US5) | — | Component-level checks in `packages/ui` (jsdom: no colour contrast) |

## 4. Discovery: current state

### 4.1 Tooling already present

- `e2e/src/a11y/axe-helper.ts` filters `serious` + `critical` and fails with a readable list; its pure functions are unit
  tested in `axe-helper.spec.ts`.
- **No spec calls `assertNoCriticalA11yViolations`** (grep over `e2e/`, `apps/`, `packages/`). Accessibility is not tested today.
- Theme: `apps/shell/src/shared/theme/theme.ts` + toggle in `apps/shell/src/shared/layout/NavBar.tsx`.
- Some semantics exist: `RemoteFallback` uses an alert, streaming uses `role="status"` (asserted in `chat.spec.ts`).

### 4.2 Draft page × state matrix (to agree in US1)

| Route | States |
|---|---|
| `/login`, `/register` | empty, validation errors, server error |
| `/chats` | empty list, with chats |
| `/chats/:chatId` | history, streaming, failed reply, queued messages, attachments, members dialog |
| `/settings` | API keys list, add/test key dialog |
| any remote route | `RemoteFallback` (see AICHAT-8) |

Each in **light** and **dark** → ~30 scans.

## 5. Implementation plan (steps)

1. Agree the matrix and blocking impacts (US1).
2. `e2e/src/tests/accessibility.spec.ts`: data-driven over the matrix; set theme via the toggle (or the stored preference),
   reach the state with existing flows (`fixtures/*-flows.ts`), call the helper. Attach the axe JSON to the report.
3. Baseline run → triage table → fix in `packages/ui` first (shared components fix many pages), then MFEs. Any exclusion has a reason.
4. Keyboard spec: Tab order and Enter/Escape on the main flows; focus trap and return in dialogs; visible focus ring;
   live region announces status, not every token.
5. Optional spike: `vitest-axe` on `packages/ui` components.
6. Run in `e2e.yml` as a merge gate; instructions in `e2e/README.md`.

## 6. User stories

| Jira | ID | Story | Acceptance criteria | Est. |
|---|---|---|---|---|
| [AICHAT-172](https://ipca-grupo11.atlassian.net/browse/AICHAT-172) | AICHAT-10-US1 | As a team, I want an agreed list of pages, states and themes | Matrix of §4.2 agreed; light + dark; WCAG 2.2 AA and blocking impacts confirmed | 1 |
| [AICHAT-173](https://ipca-grupo11.atlassian.net/browse/AICHAT-173) | AICHAT-10-US2 | As a user with assistive technology, I want every page scanned automatically | `accessibility.spec.ts` over the matrix; uses the existing helper; zero serious/critical; JSON artifact; merge gate | 5 |
| [AICHAT-174](https://ipca-grupo11.atlassian.net/browse/AICHAT-174) | AICHAT-10-US3 | As a user with assistive technology, I want the violations fixed | Triage table; fixed at the source (`packages/ui` first); exclusions justified with a follow-up | 5 |
| [AICHAT-175](https://ipca-grupo11.atlassian.net/browse/AICHAT-175) | AICHAT-10-US4 | As a keyboard and screen-reader user, I want the main flows to work without a mouse | Keyboard-only flows; dialog focus trap/return; focus ring; polite live region for streaming | 3 |
| [AICHAT-176](https://ipca-grupo11.atlassian.net/browse/AICHAT-176) | AICHAT-10-US5 | (Spike, optional) As a developer, I want component-level a11y checks | Decision recorded; if adopted, checks on Button, Input, Dialog, Alert, Select | 2 |
| | | **Total** | | **16** |

## 7. Risks and open decisions

- The baseline may show many violations; US3 size depends on it. Fix shared components first.
- Colour-contrast results differ between themes; both must pass.
- Streaming text changes constantly; scan after the stream ends, or exclude the live message from the scan with a reason.

## 8. Notes for the report

The repo already had the axe-core dependency and a tested helper, but no test used it, so accessibility was never checked.
The epic wires the helper into a page × theme matrix as a merge gate, fixes what the first run finds, and adds keyboard and
screen-reader checks that automated scanning cannot cover.
