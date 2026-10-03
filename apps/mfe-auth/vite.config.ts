/// <reference types="vitest/config" />
import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Module Federation remote exposure for the auth domain.
// Per docs/ARCHITECTURE.md §3 and docs/pods/auth/PLAN.md (F1), this remote exposes its
// route entry so the shell (owned by `platform`) can mount /login and /register.
// React/React DOM/Router/Query are shared singletons per STACK.md and AC-24 so the shell
// and every remote share one instance.
export default defineConfig({
  // Dev port the shell expects for this remote (apps/shell/module-federation.config.ts).
  server: {
    port: 5001,
    strictPort: true,
    host: "localhost",
  },
  plugins: [
    react(),
    federation({
      name: "mfeAuth",
      filename: "remoteEntry.js",
      exposes: {
        "./routes": "./src/routes.tsx",
      },
      shared: {
        react: { singleton: true, requiredVersion: false },
        "react-dom": { singleton: true, requiredVersion: false },
        "@tanstack/react-router": { singleton: true, requiredVersion: false },
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
      exclude: ["src/main.tsx", "src/routes.tsx", "src/shared/test/**"],
    }),
  },
});
