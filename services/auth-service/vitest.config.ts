import { coveragePreset, snapshotSerializerPath } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    snapshotSerializers: [snapshotSerializerPath],
    setupFiles: ["src/shared/test/setup-env.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/shared/prisma.ts", "src/shared/test/**", "src/test-utils/**"],
    }),
  },
});
