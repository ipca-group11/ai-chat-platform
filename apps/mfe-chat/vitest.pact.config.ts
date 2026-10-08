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
      "@app/shared-types/model-capabilities": path.resolve(dirname, "../../packages/shared-types/src/model-capabilities.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.pact.spec.ts"],
    globalSetup: ["./vitest.pact.setup.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
