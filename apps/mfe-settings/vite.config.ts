/// <reference types="vitest/config" />
import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Settings (configuration) microfrontend: exposes the /settings route content to
// apps/shell (the Module Federation host) per docs/pods/configuration/PLAN.md FE-1 and
// the remote conventions fixed by the shell pod (name `mfeSettings`, dev port 5003,
// exposed module `./routes`, see apps/shell/module-federation.config.ts).
export default defineConfig({
  resolve: {
    alias: {
      // TODO(integration): once a real pnpm workspace links `@app/shared-types`, this
      // alias becomes redundant (but harmless) — it lets this app build/test
      // standalone against the sibling package's source in this monorepo layout.
      "@app/shared-types/api-keys": path.resolve(
        dirname,
        "../../packages/shared-types/src/api-keys/index.ts",
      ),
    },
  },
  server: {
    port: 5003,
    host: "localhost",
  },
  preview: {
    port: 5003,
    host: "localhost",
  },
  plugins: [
    react(),
    federation({
      name: "mfeSettings",
      filename: "remoteEntry.js",
      exposes: {
        "./routes": "./src/routes.tsx",
      },
      shared: {
        react: { singleton: true, requiredVersion: false },
        "react-dom": { singleton: true, requiredVersion: false },
        "@tanstack/react-query": { singleton: true, requiredVersion: false },
        "@app/ui": { singleton: true, requiredVersion: false },
      },
    }),
  ],
  build: {
    target: "esnext",
    modulePreload: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Force a non-"production" NODE_ENV for the test run. React/ReactDOM only export
    // test-only APIs (e.g. `React.act`, used by @testing-library/react) from their
    // development builds; if the host shell exports NODE_ENV=production, Vite/Node
    // resolve react's production build instead and `render()` blows up with
    // "React.act is not a function". Vitest's `test.env` sets process.env for the
    // test run, independent of whatever NODE_ENV the invoking shell has set.
    env: {
      NODE_ENV: "test",
    },
    setupFiles: ["./src/shared/test/setup.ts", "@platform/test-utils/setup"],
    css: false,
    coverage: coveragePreset({
      thresholds: appCoverageThresholds,
      exclude: ["src/main.tsx", "src/routes.tsx", "src/app.tsx", "src/shared/test/**"],
    }),
  },
});
