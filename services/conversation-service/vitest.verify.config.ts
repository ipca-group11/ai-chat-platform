import { defineConfig } from "vitest/config";

// Pact provider verification (AICHAT-181): replays the consumers' pacts from pacts/ against
// the app in-process. Run after the consumers' pact:consumer targets.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.verify.spec.ts"],
    testTimeout: 120_000,
  },
});
