import type { TestUserConfig } from "vitest/config";
import { coverageThresholds, type CoverageThresholds } from "./coverage-thresholds.js";

export interface CoveragePresetOptions {
  /** Glob(s) of source files coverage should be computed over. */
  include?: string[];
  /** Additional excludes, appended to the default test-file/story excludes. */
  exclude?: string[];
  /**
   * Threshold overrides merged over the 80% default. Use `appCoverageThresholds` or
   * `e2eCoverageThresholds` for the other groups, or a ratcheted value with a
   * `TODO(AICHAT-17, <date>)` comment next to it.
   */
  thresholds?: Partial<CoverageThresholds>;
}

const DEFAULT_COVERAGE_EXCLUDES = [
  "**/*.spec.ts",
  "**/*.test.ts",
  "**/*.spec.tsx",
  "**/*.test.tsx",
  "**/*.spec.js",
  "**/*.test.js",
  "**/*.stories.tsx",
  "**/*.d.ts",
];

/**
 * Coverage section of a Vitest config (`STACK.md` decision #6, AC-97): `v8` provider,
 * text + lcov + json-summary reporters (lcov for CI artifact upload, json-summary for the CI summary), and the shared 80%
 * line/statement/function/branch thresholds from `coverage-thresholds.ts`.
 *
 * Usage in a project's own `vitest.config.ts`:
 * ```ts
 * import { defineConfig } from "vitest/config";
 * import { coveragePreset } from "@platform/test-config";
 *
 * export default defineConfig({
 *   test: {
 *     environment: "node",
 *     include: ["src/**\/*.spec.ts"],
 *     coverage: coveragePreset({ include: ["src/**\/*.ts"] }),
 *   },
 * });
 * ```
 */
export function coveragePreset(options: CoveragePresetOptions = {}) {
  return {
    provider: "v8" as const,
    // json-summary writes coverage/coverage-summary.json, read by the CI summary.
    reporter: ["text", "lcov", "json-summary"] as Array<"text" | "lcov" | "json-summary">,
    ...(options.include ? { include: options.include } : {}),
    exclude: [...DEFAULT_COVERAGE_EXCLUDES, ...(options.exclude ?? [])],
    thresholds: { ...coverageThresholds, ...options.thresholds },
  };
}

/**
 * Full Vitest config fragment (`test.coverage` plus a sane `node` default environment).
 * Projects needing `jsdom` (frontend `apps/*`, `packages/ui`) should override `environment`
 * after spreading this preset. Intended to be combined with a project's own `test.include`
 * via `vitest/config`'s `mergeConfig`, or spread manually since Vitest config objects are
 * plain objects.
 */
export function vitestPreset(options: CoveragePresetOptions = {}): { test: TestUserConfig } {
  return {
    test: {
      environment: "node",
      coverage: coveragePreset(options),
    },
  };
}
