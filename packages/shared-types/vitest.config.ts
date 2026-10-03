import { coveragePreset, snapshotSerializerPath } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    snapshotSerializers: [snapshotSerializerPath],
    coverage: coveragePreset({ include: ["src/**/*.ts"], exclude: ["src/index.ts"] }),
  },
});
