import { coveragePreset, snapshotSerializerPath } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    // Pact provider verification runs in its own config (vitest.verify.config.ts).
    exclude: ["src/**/*.db.spec.ts", "src/**/*.verify.spec.ts", "node_modules/**"],
    snapshotSerializers: [snapshotSerializerPath],
    setupFiles: ["src/test-utils/setup-no-network.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts", "src/shared/prisma.ts", "src/test-utils/**", "src/test-db/**"],
    }),
  },
});
