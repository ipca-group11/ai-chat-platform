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
      // Only the pure, browser-independent logic (health polling, a11y
      // result filtering) is meaningfully unit-testable here; the
      // Playwright-only wrappers (auth-flows/chat-flows/test-users/
      // wait-for-stack-cli) are exercised by the `e2e` Playwright target
      // instead.
      include: ["src/fixtures/wait-for-stack.ts", "src/a11y/axe-helper.ts"],
    }),
  },
});
