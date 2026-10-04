import { defineConfig } from "vitest/config";

// Database tests (`test-db` Nx target): a real Postgres from Testcontainers, so Docker must be running.
// The unit `test` target skips `*.db.spec.ts` (see vitest.config.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.spec.ts"],
    globalSetup: ["../../packages/test-config/test-utils/postgres-global-setup.ts"],
    setupFiles: ["src/test-db/setup-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
