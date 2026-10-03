import type { TestUserConfig } from "vitest/config";
import type { CoverageThresholds } from "./coverage-thresholds.js";

export interface CoveragePresetOptions {
  /** Glob(s) of source files coverage should be computed over. */
  include?: string[];
  /** Additional excludes, appended to the default test-file/story excludes. */
  exclude?: string[];
  /** Threshold overrides merged over the 80% default. */
  thresholds?: Partial<CoverageThresholds>;
}

export function coveragePreset(options?: CoveragePresetOptions): {
  provider: "v8";
  reporter: Array<"text" | "lcov" | "json-summary">;
  include?: string[];
  exclude: string[];
  thresholds: CoverageThresholds;
};

export function vitestPreset(options?: CoveragePresetOptions): { test: TestUserConfig };
