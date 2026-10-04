import { coveragePreset } from "@platform/test-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["*.spec.ts"],
    coverage: coveragePreset({ include: ["*.ts"], exclude: ["vitest.config.ts"] }),
  },
});
