/// <reference types="vitest/config" />
import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// Chat microfrontend: exposes /chats, /chats/:id routes and a mount function to
// apps/shell (the Module Federation host). See docs/pods/chat/PLAN.md FE-1 and
// docs/ARCHITECTURE.md §3 for the module map / remote contract.
export default defineConfig({
  // Dev port the shell expects for this remote (apps/shell/module-federation.config.ts).
  server: {
    port: 5002,
    strictPort: true,
    host: "localhost",
  },
  plugins: [
    react(),
    federation({
      name: "mfe_chat",
      filename: "remoteEntry.js",
      exposes: {
        "./routes": "./src/app/routes.tsx",
        "./remote-entry": "./src/app/remote-entry.tsx",
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
        "@tanstack/react-query": { singleton: true },
        "@tanstack/react-router": { singleton: true },
        "@app/ui": { singleton: true, requiredVersion: false },
      },
    }),
  ],
  build: {
    target: "esnext",
    modulePreload: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts", "@platform/test-utils/setup"],
    css: false,
    testTimeout: 15000,
    coverage: coveragePreset({
      thresholds: appCoverageThresholds,
      // Only real bootstrap files stay out: the Module Federation mount entry has no logic of
      // its own. Routes, pages, workspace, auth-context and split-panes now count.
      exclude: ["src/test/**", "**/index.ts", "src/app/remote-entry.tsx"],
    }),
  },
});
