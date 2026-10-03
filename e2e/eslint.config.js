// Standalone flat config (no workspace-linked packages): the `e2e` package
// is copied out of the monorepo on its own for the deployed-app `e2e`
// factory command (plain `npm install`, no pnpm workspace), so it cannot
// depend on `@platform/eslint-config` (published as `workspace:*`).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["playwright-report", "test-results", "node_modules"] },
];
