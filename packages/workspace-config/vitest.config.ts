import { coveragePreset } from "@platform/test-config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // The parity test imports both consumers from source; they read the shared module from source too.
      "@app/shared-types/model-capabilities": path.resolve(dirname, "../shared-types/src/model-capabilities.ts"),
      // Aliases (not relative paths) so the cross-project imports of the parity test stay explicit here.
      "@parity/mfe-chat": path.resolve(dirname, "../../apps/mfe-chat/src"),
      "@parity/conversation-service": path.resolve(dirname, "../../services/conversation-service/src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: coveragePreset({ include: ["src/**/*.ts"] }),
  },
});
