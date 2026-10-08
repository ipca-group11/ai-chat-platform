import { defineConfig } from "vitest/config";

// Pact consumer tests (AICHAT-11): auth-service as a consumer of conversation-service's
// internal routes. One file at a time, because both files add to the same pact file.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.pact.spec.ts"],
    globalSetup: ["./vitest.pact.setup.ts"],
    fileParallelism: false,
  },
});
