# QA report: design-system pod

Verdict: PASS

## Scope

Pod `design-system` owns `packages/ui` only (US-5, US-6 / AC-15 through AC-21 in
`docs/BACKLOG.json`). Per `docs/pods/design-system/PLAN.md`, AC-18 ("every microfrontend
uses only design-system components, with no ad-hoc primitive markup") is primarily
fulfilled by the consuming pods (`shell`, `auth`, `chat`, `configuration`), which are not
present in this worktree. This pod's own responsibility toward AC-18 — exporting a
complete, clean public API so consumers never need ad-hoc primitive markup — is now
covered by a test in this package (see below).

## Test command

`.factory/commands.json` specifies `pnpm exec nx affected -t lint typecheck test build
--base=origin/main --head=HEAD`. This pod's git worktree contains only `docs/` +
`packages/ui/` (no root `package.json`/`nx.json` — those are owned by the
`platform-foundation` pod), so `nx affected` cannot run standalone here. The equivalent
`packages/ui` Nx targets (`lint`, `typecheck`, `test`, `build`) were run directly instead,
using the exact commands defined in `packages/ui/project.json`:

| Target | Command | Result |
|---|---|---|
| `lint` | `eslint .` | ✅ passed, no errors |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | ✅ passed, no errors |
| `test` | `vitest run` (cwd `packages/ui`) | ✅ 21 files / 128 tests passed |
| `build` | `vite build && tsc -p tsconfig.build.json --noEmit false --emitDeclarationOnly` | ✅ passed |

Coverage (`vitest run --coverage`): 99.55% statements / 91.02% branches / 100% functions /
99.55% lines overall — comfortably above the package's own 80% thresholds
(`vite.config.ts` `test.coverage.thresholds`).

A prior QA pass on this pod recorded `lint` crashing due to a `typescript@7.0.2` /
`typescript-eslint@8.70.1` version mismatch. That mismatch is no longer present —
`package.json` now pins `typescript@6.0.3` — and `eslint .` runs clean; this is recorded
as resolved, not re-fixed by this QA pass (no application code was changed).

## Tests added by this QA pass

Application/component code was not modified. The following test files were added to
close AC-id coverage gaps and strengthen weakly-evidenced criteria (all other ACs already
had at least one test whose name includes its id):

- `src/index.test.ts` — **AC-18** had zero tests. Adds 50 tests asserting every required
  primitive (Button, Input, Textarea, Label, FormField, Card family, Dialog, Dropdown
  menu, Select, Tabs, Toast, Badge, Avatar, Skeleton, Tooltip, typography) is exported
  from the single `@app/ui` entry point, and that every primitive category an mfe needs
  (actions/forms/surfaces/overlays/navigation/feedback/typography) is present — the
  necessary precondition, owned by this pod, for consumers to have no reason to write
  ad-hoc primitive markup.
- `src/storybook-a11y-config.test.ts` — **AC-20** already had tests, but they only
  exercised focus-management behavior, not the Axe-addon wiring itself. Adds 3 tests
  pinning that `@storybook/addon-a11y` is registered in `.storybook/main.ts` and that
  `parameters.a11y.test` is set to `'error'` globally in `.storybook/preview.tsx` (so a
  regression removing/weakening the addon is caught).
- `src/design-tokens.test.ts` — **AC-16** already had tests, but only for
  class-name application, not the dark-mode token set itself. Adds 3 tests asserting
  `globals.css`'s `.dark` block defines an override for every color token declared in
  `:root` (and no extras), i.e. dark mode actually re-themes every token light mode
  defines.

## Acceptance criteria coverage

| AC | Text (abridged) | Test(s) | Status |
|----|------------------|---------|--------|
| AC-15 | 15 components + typography implemented on shadcn/ui + Base UI | `AC-15` tests across `button`, `input`, `textarea`, `label`, `form-field`, `card`, `dialog`, `dropdown-menu`, `select`, `tabs`, `badge`, `avatar`, `skeleton` test files; typography under AC-17; `src/index.test.ts` confirms all are publicly exported | PASS |
| AC-16 | Tailwind design tokens for color/spacing/radius/typography; light+dark mode | `AC-16` tests in `button`, `input`, `textarea`, `card`, `badge`, `avatar`, `skeleton`, `tooltip`, `toast`, `typography`; new `src/design-tokens.test.ts` verifies full `:root`/`.dark` token parity | PASS |
| AC-17 | Typography follows shadcn Typeset scale | `AC-17` tests (7) in `typography.test.tsx` | PASS |
| AC-18 | Every microfrontend uses only design-system components, no ad-hoc primitive markup | New `src/index.test.ts` (50 tests) verifies this pod's owned precondition — a complete public API surface. Actual mfe usage lives in `shell`/`auth`/`chat`/`configuration` pods, outside this worktree/pod's ownership, per `PLAN.md` | PASS (for this pod's scope) |
| AC-19 | Every component has Storybook stories covering variants/states | Co-located `*.stories.tsx` present for all 16 component dirs; behavioral `AC-19` unit tests in every component test file | PASS |
| AC-20 | Storybook a11y (Axe) addon enabled, zero violations per story | `@storybook/addon-a11y` wired globally (`a11y: { test: 'error' }`); new `src/storybook-a11y-config.test.ts` pins that wiring; focus-management `AC-19/AC-20` tests in `dialog`, `dropdown-menu`, `select`, `tabs` | PASS |
| AC-21 | `storybook` Nx target builds and serves the design system's Storybook instance | `src/storybook-build.test.ts` (`AC-21`) shells out to the real `storybook build` CLI (same config as the `storybook`/`build-storybook` Nx targets) and asserts `index.html`/`iframe.html` are produced | PASS |

## Notes / residual risk (not failures)

- **AC-20's "zero violations for every story"** is enforced by Storybook's own
  `@storybook/addon-a11y` at story-render time (dev server or a built static instance),
  not by an additional automated axe scan inside `vitest run` — this project's
  toolchain has no `addon-vitest`/portable-stories/test-runner integration wired up to
  execute each story as a Vitest test. `src/storybook-a11y-config.test.ts` guards the
  *configuration* that makes this enforceable (addon registered, `test: 'error'`
  globally) but cannot itself prove zero violations exist right now for every story
  without launching a real browser against the built output (no Playwright/Puppeteer
  is available in this package's toolchain). This is a coverage note, not a failure:
  the addon is correctly enabled and configured per AC-20's first clause.
- **AC-18's cross-mfe enforcement** (that `mfe-auth`/`mfe-chat`/`mfe-settings` contain no
  ad-hoc primitive markup) is not verifiable from this pod's worktree, which contains
  only `packages/ui`. This pod's contribution (a complete, single-entry-point component
  API) is verified; full AC-18 verification should also be checked from the `shell`,
  `auth`, `chat`, and `configuration` pods' own QA passes.

## Failing details

None. All four Nx-equivalent targets (`lint`, `typecheck`, `test`, `build`) pass, and
every acceptance criterion owned by this pod has at least one test whose name includes
its id.
