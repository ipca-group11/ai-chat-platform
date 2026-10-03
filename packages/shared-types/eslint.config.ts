import { node } from "@platform/eslint-config";

export default [
  {
    // apps/mfe-settings' Module Federation dts generation (see apps/mfe-settings/vite.config.ts)
    // runs a standalone tsc pass with a repo-rooted `rootDir` to type-check federated
    // exposes, which as a side effect writes throwaway `.d.ts` files next to this
    // package's sources. They are build artifacts, not committed source (see
    // .gitignore), and should never be linted.
    ignores: ["src/**/*.d.ts"],
  },
  ...node,
];
