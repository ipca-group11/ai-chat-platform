import js from "@eslint/js";
import nxPlugin from "@nx/eslint-plugin";
import vitestPlugin from "@vitest/eslint-plugin";
import tseslint from "typescript-eslint";
import type { ConfigArray } from "typescript-eslint";
import localPlugin from "./local-plugin.ts";

// NOTE: `typescript-eslint`/`@nx/eslint-plugin` do not yet support the TS 7.0 native
// compiler API (STACK.md mandates TypeScript 7.0.2 for building/typechecking every
// project; see https://github.com/typescript-eslint/typescript-eslint/issues/10940).
// This package alone pins its own `typescript` devDependency to `6.0.3` (see
// `package.json`) purely so that *this linting toolchain* resolves the classic
// compiler API it needs; every other project in the workspace still builds/typechecks
// against the real `typescript@7.0.2` from the root. Remove this pin once
// typescript-eslint ships native TS 7 support.

/**
 * Base flat-config preset shared by every project (apps, services, packages). Wires up:
 *  - typescript-eslint recommended + stylistic rules,
 *  - `@nx/enforce-module-boundaries` using the workspace tag scheme
 *    (`type:app|service|package`, `scope:shell|auth|chat|settings|shared`) from
 *    `ARCHITECTURE.md` §2 / this pod's `nx.json` conventions,
 *  - the local `feature-folder-boundaries` rule (SPEC §3.3).
 *
 * Consumers extend this via `packages/eslint-config`'s `react` or `node` preset, which
 * both spread `base` first.
 */
const base: ConfigArray = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.nx/**",
      "**/build/**",
      "**/storybook-static/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@nx": nxPlugin,
      platform: localPlugin,
    },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: ["type:package"],
            },
            {
              sourceTag: "type:service",
              onlyDependOnLibsWithTags: ["type:package"],
            },
            {
              sourceTag: "type:package",
              onlyDependOnLibsWithTags: ["type:package"],
            },
          ],
        },
      ],
      "platform/feature-folder-boundaries": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Snapshot policy (docs/AICHAT-20): DTOs, wire output and the rendered DOM of every app
  // story (apps/*/src/stories.snapshot.test.tsx). Big outputs go to .snap files.
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    plugins: { vitest: vitestPlugin },
    rules: {
      // Inline snapshots above 50 lines are too big to review in the test file.
      "vitest/no-large-snapshots": ["error", { maxSize: 50 }],
    },
  },
);

export default base;