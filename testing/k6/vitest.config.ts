import { defineConfig } from "vitest/config";

// `load.ts` and `lib/api.ts` run in the k6 runtime, not in Node. The scenario definitions
// (`lib/scenarios.ts`) have no k6 imports, so they are the part Vitest checks.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.spec.ts"],
  },
});
