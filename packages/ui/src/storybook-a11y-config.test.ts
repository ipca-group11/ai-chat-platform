// @vitest-environment node
//
// Read (rather than import/execute) the Storybook config sources: `.storybook/main.ts`
// uses `import.meta.url` / `node:url` in ways that don't survive being executed under
// the jsdom browser-like environment used by the rest of this package's component
// tests, and executing Storybook config as a module is unnecessary anyway - the
// wiring this test cares about (which addons are registered, which global parameters
// are set) is plain, statically-readable source text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(join(__dirname, '../.storybook/main.ts'), 'utf-8');
const previewSource = readFileSync(join(__dirname, '../.storybook/preview.tsx'), 'utf-8');

// AC-20: "The Storybook accessibility (Axe) addon is enabled and reports zero
// violations for every story."
//
// Whether a given story currently has zero violations is a runtime fact about each
// rendered story, surfaced live in Storybook's "Accessibility" panel (and, for a
// static build, in the equivalent panel of the built instance produced by the
// `storybook`/`build-storybook` targets covered by AC-21) — there is no separate
// "violations" artifact this package emits that a unit test could assert against
// without either running a real browser against the built Storybook or wiring up an
// additional test runner (e.g. an addon-vitest/portable-stories integration), neither
// of which is part of this package's current toolchain.
//
// What *is* fully within this test suite's power, and what actually makes "zero
// violations for every story" achievable/enforceable at all, is that the addon is
// correctly registered and configured to treat violations as failures. This test
// pins that configuration so a regression (e.g. someone removing the addon, or
// downgrading `a11y.test` from `'error'`) is caught here.
describe('Storybook Axe (a11y) addon configuration (AC-20)', () => {
  it('AC-20: registers @storybook/addon-a11y in the Storybook config', () => {
    expect(mainSource).toMatch(/addons\s*:\s*\[[^\]]*['"]@storybook\/addon-a11y['"]/s);
  });

  it('AC-20: sets the global a11y test mode to "error" so violations fail, for every story', () => {
    expect(previewSource).toMatch(/a11y\s*:\s*\{\s*test\s*:\s*['"]error['"]/);
  });

  it('AC-20: applies the a11y parameter globally via `preview.parameters`, not opt-in per story, so every story in the declared glob is covered', () => {
    // The `a11y` parameter lives on the shared `preview` default export (applied to
    // every story), not scoped inside an individual story's own `parameters`.
    expect(previewSource).toMatch(/const preview: Preview = \{[\s\S]*parameters: \{[\s\S]*a11y: \{/);
    // ...and that shared preview config applies to every story matched by this glob.
    expect(mainSource).toContain("stories: ['../src/**/*.stories.@(ts|tsx)']");
  });
});
