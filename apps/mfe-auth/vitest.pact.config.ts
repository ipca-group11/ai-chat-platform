import { defineConfig } from "vitest/config";

// Pact consumer tests (AICHAT-11): Node environment and no MSW, so the real API client
// reaches the Pact mock server. One file at a time, because every file of this app adds
// interactions to the same pact file per provider.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.pact.spec.ts"],
    globalSetup: ["./vitest.pact.setup.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
