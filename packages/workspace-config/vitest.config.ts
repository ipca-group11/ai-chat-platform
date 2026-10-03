import { coveragePreset } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    coverage: coveragePreset({ include: ["src/**/*.js"] }),
  },
});
