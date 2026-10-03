import node from "@platform/eslint-config/node";

export default [
  ...node,
  { ignores: ["dist"] },
  {
    // `@platform/eslint-config` uses this package in its vitest config (AICHAT-81) and this
    // package uses its lint preset: a lint-time-only cycle that is intentional, so the
    // circular-dependency check is switched off for this one file.
    files: ["eslint.config.js"],
    rules: { "@nx/enforce-module-boundaries": "off" },
  },
];
