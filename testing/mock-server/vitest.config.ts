import { coveragePreset } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Several nx targets run at once on CI and on laptops; the default 5 s is too tight for the
    // first request of a cold worker.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.spec.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
    }),
  },
});
