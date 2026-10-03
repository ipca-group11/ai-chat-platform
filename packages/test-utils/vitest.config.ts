import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    env: { NODE_ENV: "test" },
    // The package tests itself with the same setup file the microfrontends use.
    setupFiles: ["@testing-library/jest-dom/vitest", "./src/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: coveragePreset({
      include: ["src/**/*.{ts,tsx}"],
      thresholds: appCoverageThresholds,
    }),
  },
});
