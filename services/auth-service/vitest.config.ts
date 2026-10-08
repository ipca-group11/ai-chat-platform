import { coveragePreset, snapshotSerializerPath } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // bcrypt at the real cost is slow when several projects test at once (nx --parallel).
    testTimeout: 20_000,
    include: ["src/**/*.spec.ts"],
    // Pact tests run in their own configs (vitest.pact.config.ts, vitest.verify.config.ts).
    exclude: ["src/**/*.db.spec.ts", "src/**/*.pact.spec.ts", "src/**/*.verify.spec.ts", "node_modules/**"],
    snapshotSerializers: [snapshotSerializerPath],
    setupFiles: ["src/shared/test/setup-env.ts"],
    coverage: coveragePreset({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/shared/prisma.ts", "src/shared/test/**", "src/test-utils/**", "src/test-db/**"],
    }),
  },
});
