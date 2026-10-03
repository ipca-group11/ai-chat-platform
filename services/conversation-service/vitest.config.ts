import { coveragePreset } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    setupFiles: ["src/test-utils/setup-no-network.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts", "src/shared/prisma.ts", "src/test-utils/**"],
    }),
  },
});
