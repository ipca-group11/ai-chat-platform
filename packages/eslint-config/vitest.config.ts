import { defineConfig } from "vitest/config";

// Coverage is configured inline instead of through `@platform/test-config`: that package uses
// this one for linting, so importing it here would create a dependency cycle. The values
// must stay identical to the shared preset (80/80/80/80, text + lcov + json-summary); the
// guard in packages/workspace-config lists this project as an exempt, with this reason.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/rules/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.test.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
