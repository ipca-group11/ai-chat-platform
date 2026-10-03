import base from "./base.js";

/**
 * Preset for Node backend projects (`services/*`): base + a couple of Node-specific
 * tweaks (no DOM globals assumed, console allowed for structured logging setup files).
 */
const node = [
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
