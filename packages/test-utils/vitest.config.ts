import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    env: { NODE_ENV: "test" },
    setupFiles: ["@testing-library/jest-dom/vitest"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: coveragePreset({
      include: ["src/**/*.{ts,tsx}"],
      thresholds: appCoverageThresholds,
    }),
  },
});
