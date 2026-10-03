# Plan: design-system pod

Source stories: `docs/BACKLOG.json` pod `design-system` (US-5, US-6).
Scope per `docs/ARCHITECTURE.md` / `docs/SPEC.md` §3.4: **`packages/ui`** only — the
shared shadcn/ui-on-Base-UI component library, Tailwind design tokens, and its
Storybook documentation. This pod has no backend service and no app of its own; other
pods (`shell`, `auth`, `chat`, `configuration`) consume `packages/ui` but do not own it.

## Assumptions / cross-pod notes
- `packages/ui` does not exist yet when this pod starts. This pod creates the whole
  package: `package.json`, Nx `project.json` (targets: `lint`, `typecheck`, `test`,
  `build`, `storybook`), `tsconfig.json`, Tailwind/PostCSS config, and Vite lib build
  config.
- If `packages/eslint-config` / `packages/tsconfig` (owned by `platform-foundation`) do
  not exist yet at implementation time, add a minimal local ESLint flat config and
  tsconfig in `packages/ui` so the package is independently lintable/buildable; the
  Tech Lead integration pass will rewire these to extend the shared configs once
  `platform-foundation` lands.
- AC-18 ("every microfrontend uses only design-system components") is fulfilled by the
  consuming pods (`shell`, `auth`, `chat`, `configuration`), not by this pod directly.
  This pod's responsibility toward AC-18 is to export a clean public API (single
  `src/index.ts` barrel) and keep components generic/unstyled-by-feature so consumers
  never need ad-hoc primitive markup.
- No pod other than `design-system` edits `packages/ui/**` directly; other pods propose
  changes via PR per `ARCHITECTURE.md` §2.

## Tasks

All tasks are frontend/library tasks (no backend service in this pod). Ordered by
dependency; Task 1 must land before/alongside the others since it defines the package
scaffold, tokens, and Storybook config that every component and story relies on.

### Task 1 — Package scaffold, design tokens, and Storybook/a11y setup
**Owns:** `packages/ui/package.json`, `packages/ui/project.json`, `packages/ui/tsconfig*.json`,
`packages/ui/tailwind.config.ts`, `packages/ui/postcss.config.js`, `packages/ui/vite.config.ts`,
`packages/ui/src/styles/globals.css` (CSS variables/tokens for color, spacing, radius,
typography, light + dark themes), `packages/ui/src/lib/utils.ts` (`cn` helper),
`packages/ui/.storybook/main.ts`, `packages/ui/.storybook/preview.tsx`,
`packages/ui/src/index.ts` (barrel, starts empty and is appended to by Tasks 2-4).

**Covers:**
- AC-16 (Tailwind design tokens for color/spacing/radius/typography; light + dark mode)
- AC-20 (`@storybook/addon-a11y` installed and enabled globally in `.storybook/preview.tsx`,
  with a dark-mode toolbar toggle so both themes get checked)
- AC-21 (Nx `storybook` target on `packages/ui` builds/serves Storybook)
- Groundwork for AC-15 (package builds and exports Base UI + Tailwind-based components)

**Definition of done:** `nx run ui:build`, `nx run ui:lint`, `nx run ui:typecheck`, and
`nx run ui:storybook` all run (storybook serves an empty but configured instance); dark
mode class strategy documented in `globals.css`.

### Task 2 — Form & content primitives + stories
**Owns:** `packages/ui/src/components/{button,input,textarea,label,form-field,card,badge,avatar,skeleton,tooltip}/**`
(component + co-located `*.stories.tsx` per component), adds these exports to
`packages/ui/src/index.ts`.

**Components:** Button, Input, Textarea, Label, Form field, Card, Badge, Avatar,
Skeleton, Tooltip — generated via shadcn/ui CLI/patterns but wired to
`@base-ui-components/react` primitives (not Radix), styled with the Task 1 tokens.

**Covers:** AC-15 (these 10 components), AC-16 (theming/dark mode applied per
component), AC-19 (stories covering each variant/state: sizes, disabled, error,
loading, etc.), AC-20 (zero Axe violations per story).

**Depends on:** Task 1 (tokens, `cn` util, Storybook config).

### Task 3 — Overlay, navigation & feedback primitives + stories
**Owns:** `packages/ui/src/components/{dialog,dropdown-menu,select,tabs,toast}/**`
(component + co-located stories), adds exports to `packages/ui/src/index.ts`.

**Components:** Dialog, Dropdown menu, Select, Tabs, Toast — on Base UI primitives
(`@base-ui-components/react` popover/dialog/menu/tabs primitives), including
focus-trap/keyboard-nav behavior needed for accessibility.

**Covers:** AC-15 (these 5 components), AC-16, AC-19 (stories per variant/state,
including open/closed, multiple items, error toast, etc.), AC-20 (zero Axe violations,
including focus-management checks for dialog/dropdown/select).

**Depends on:** Task 1. Can run in parallel with Task 2 and Task 4 (disjoint files,
only shared touch point is appending to `src/index.ts` — keep each append as a small,
independent line addition to minimize merge conflicts).

### Task 4 — Typography components (shadcn Typeset) + stories
**Owns:** `packages/ui/src/components/typography/**` (component + co-located stories),
adds exports to `packages/ui/src/index.ts`.

**Components:** heading levels (H1-H4), paragraph, lead, large/small text, muted text,
blockquote, inline code, list — matching the shadcn Typeset scale and following the
Task 1 typography tokens.

**Covers:** AC-15 (typography components), AC-16, AC-17 (Typeset scale/hierarchy),
AC-19, AC-20.

**Depends on:** Task 1. Can run in parallel with Task 2 and Task 3.

## Acceptance criteria coverage map
| AC | Covered by |
|----|------------|
| AC-15 | Task 1 (scaffold) + Task 2 + Task 3 + Task 4 (full component list) |
| AC-16 | Task 1 (tokens/dark mode) + Task 2/3/4 (applied per component) |
| AC-17 | Task 4 |
| AC-18 | Out of scope for this pod (consumer pods); enabled via Task 1's clean `index.ts` barrel |
| AC-19 | Task 2 + Task 3 + Task 4 (stories co-located with each component) |
| AC-20 | Task 1 (addon-a11y setup) + Task 2/3/4 (zero violations per story) |
| AC-21 | Task 1 |

## Definition of done for the pod
- `nx run ui:lint`, `nx run ui:typecheck`, `nx run ui:test`, `nx run ui:build`, and
  `nx run ui:storybook` all pass.
- All 15+ components from SPEC §3.4 exist, are exported from `packages/ui/src/index.ts`,
  and have Storybook stories with zero Axe violations.
- Light and dark mode are visually verifiable in Storybook via the preview toolbar.
