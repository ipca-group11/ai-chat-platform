import { coveragePreset, e2eCoverageThresholds } from "@platform/test-config";
import { defineConfig } from "vitest/config";

// Unit-tests only the plain TS logic that backs the Playwright suite
// (fixtures/a11y helpers). The actual `*.spec.ts` files under src/tests are
// Playwright specs, run via the `e2e` Nx target (`playwright test`), not
// Vitest.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/fixtures/**/*.spec.ts", "src/a11y/**/*.spec.ts", "src/ci/**/*.spec.ts"],
    coverage: coveragePreset({
      thresholds: e2eCoverageThresholds,
      // The Playwright flow helpers are unit-tested against a recording fake page (src/test-utils);
      // the specs under src/tests are Playwright specs and run through the `e2e` target.
      include: ["src/fixtures/**/*.ts", "src/a11y/axe-helper.ts"],
      exclude: ["**/*.spec.ts"],
    }),
  },
});
