import { defineConfig } from "vitest/config";

// `streaming-load.js` runs under the k6 runtime, not Node/Vitest (see README.md), so this
// suite only does static, structural assertions on the script's source text (VU count,
// scenario shape, thresholds) - it does not execute the k6 script itself. No coverage is
// collected since there is no Node-executable source to instrument.
export default defineConfig({
  test: {
    environment: "node",
    include: ["*.spec.ts"],
  },
});
