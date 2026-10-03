// @vitest-environment node
//
// This suite shells out to the real Storybook CLI and touches the filesystem/tmpdir;
// it needs Node built-ins to behave as they do outside a browser, unlike the jsdom
// environment used by the component tests in this package.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// AC-21: "The `storybook` Nx target builds and serves the design system's Storybook
// instance." The `storybook` Nx target runs `storybook dev` (interactive/serve mode,
// not practical to assert on in an automated test), but it and `build-storybook` share
// the same Storybook configuration (.storybook/main.ts, preview.tsx) and story glob.
// Actually invoking a production build is the most direct, non-flaky way to prove that
// configuration produces a working Storybook instance without starting a long-lived
// dev server in the test run.
describe('Storybook build (packages/ui)', () => {
  it(
    'AC-21: `storybook build` (same config as the `storybook`/`build-storybook` Nx targets) produces a servable Storybook instance',
    () => {
      const outDir = mkdtempSync(join(tmpdir(), 'ui-storybook-build-'));
      try {
        execFileSync(
          'pnpm',
          ['exec', 'storybook', 'build', '--quiet', '-o', outDir],
          {
            cwd: process.cwd(),
            stdio: 'pipe',
            timeout: 120_000,
            env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
          },
        );

        expect(existsSync(join(outDir, 'index.html'))).toBe(true);
        expect(existsSync(join(outDir, 'iframe.html'))).toBe(true);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    },
    150_000,
  );
});
