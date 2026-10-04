import { defineConfig } from "vitest/config";
import { coveragePreset } from "./vitest.preset.ts";

export default defineConfig({
  test: {
    environment: "node",
    include: ["*.spec.ts"],
    coverage: coveragePreset({ include: ["*.ts"], exclude: ["postgres-global-setup.ts"] }),
  },
});
