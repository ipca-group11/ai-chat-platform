import type { ConfigArray } from "typescript-eslint";
import base from "./base.ts";

/**
 * Preset for Node backend projects (`services/*`): base + a couple of Node-specific
 * tweaks (no DOM globals assumed, console allowed for structured logging setup files).
 */
const node: ConfigArray = [
  ...base,
  {
    languageOptions: {
      globals: {
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];

export default node;
