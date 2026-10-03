/**
 * Shared Vitest coverage thresholds (`STACK.md` decision #6, AC-97): 80% line/statement/
 * function/branch coverage, enforced on `services/*` and `packages/ui` business logic.
 * Every project's own `vitest.config.ts` spreads `coverageThresholds` into its
 * `test.coverage.thresholds` option (directly, or via `vitestPreset` in `vitest.preset.ts`)
 * so `nx affected -t test` fails the build when a project's coverage drops below this bar.
 */
export const coverageThresholds = Object.freeze({
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 80,
});

/** Thresholds for `apps/mfe-*` and `apps/shell` (AICHAT-34 README §5): branches 75. */
export const appCoverageThresholds = Object.freeze({
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 75,
});

/** Thresholds for the `e2e` helper project (AICHAT-34 README §5): branches 70. */
export const e2eCoverageThresholds = Object.freeze({
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 70,
});

