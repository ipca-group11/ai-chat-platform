import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Pact consumer tests (AICHAT-11): Node environment and no MSW, so the real API client
// reaches the Pact mock server. One file at a time, because every file of this app adds
// interactions to the same pact file per provider. Same alias as vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@app/shared-types/api-keys": path.resolve(dirname, "../../packages/shared-types/src/api-keys/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.pact.spec.ts"],
    globalSetup: ["./vitest.pact.setup.ts"],
    fileParallelism: false,
    // Built with /api in Docker (Dockerfile ARG), like the shell proxy path.
    env: { NODE_ENV: "test", VITE_CONVERSATION_SERVICE_URL: "/api" },
  },
});
