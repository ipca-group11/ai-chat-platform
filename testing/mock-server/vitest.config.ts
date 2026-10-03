import { coveragePreset } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
    }),
  },
});
