/**
 * Shared Vitest coverage thresholds (`STACK.md` decision #6, AC-97): 80% line/statement/
 * function/branch coverage, enforced on `services/*` and `packages/ui` business logic.
 * Every project's own `vitest.config.ts` spreads `coverageThresholds` into its
 * `test.coverage.thresholds` option (directly, or via `vitestPreset` in `vitest.preset.ts`)
 * so `nx affected -t test` fails the build when a project's coverage drops below this bar.
 */
export const coverageThresholds = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 80,
} as const;

export type CoverageThresholds = typeof coverageThresholds;
