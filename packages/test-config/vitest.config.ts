import { defineConfig } from "vitest/config";
import { coveragePreset } from "./vitest.preset.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["*.spec.ts"],
    coverage: coveragePreset({ include: ["*.ts"], exclude: ["vitest.config.ts"] }),
  },
});
