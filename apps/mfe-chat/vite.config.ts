/// <reference types="vitest/config" />
import { coveragePreset, appCoverageThresholds } from "@platform/test-config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Chat microfrontend: exposes /chats, /chats/:id routes and a mount function to
// apps/shell (the Module Federation host). See docs/pods/chat/PLAN.md FE-1 and
// docs/ARCHITECTURE.md §3 for the module map / remote contract.
export default defineConfig({
  resolve: {
    alias: {
      // The model catalogue shared with conversation-service (AICHAT-133); read from source so
      // the app builds and tests without building the package first.
      "@app/shared-types/model-capabilities": path.resolve(
        dirname,
        "../../packages/shared-types/src/model-capabilities.ts",
      ),
      // The stream event types of conversation-service (AICHAT-221), from source for the same reason.
      "@app/shared-types/stream-events": path.resolve(dirname, "../../packages/shared-types/src/stream-events.ts"),
    },
  },
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
        // AICHAT-239: per-component entries of the design system, loaded with the dialogs that use them.
        "@app/ui/dialog": { singleton: true, requiredVersion: false },
        "@app/ui/select": { singleton: true, requiredVersion: false },
      },
      // AICHAT-237: take the shared libraries from the shell as loaded, and reuse the shell's
      // federation runtime (globalThis._FEDERATION_RUNTIME_CORE) instead of bundling a copy.
      shareStrategy: "loaded-first",
      experiments: { externalRuntime: true },
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
