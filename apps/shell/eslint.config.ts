// TODO(integration): replace with `packages/eslint-config` (owned by
// platform-foundation, see docs/ARCHITECTURE.md §2) once it is available in
// the workspace; this is a local stand-in flat config so `apps/shell` can
// lint standalone (per docs/pods/shell/PLAN.md "Workspace root exists"
// assumption).
//
// KNOWN BLOCKER (as of this writing): `typescript-eslint` (all published
// versions, including the `canary` dist-tag) hard-refuses to run against
// TypeScript >=7 — see
// https://github.com/typescript-eslint/typescript-eslint/issues/10940. Since
// `docs/STACK.md` mandates TypeScript 7.0.2, `npx eslint src` currently
// throws `typescript-eslint does not support TS 7.0.` at startup in *any*
// project wired this way (not specific to this app). `tsc -b --noEmit`
// (typecheck) and `vitest` (test) are unaffected and pass. This config is
// left in place, ready to work once typescript-eslint ships TS 7 support (or
// `packages/eslint-config` pins a compatible combination) — flag this to the
// `platform-foundation` pod / integrator rather than downgrading the
// mandated TypeScript version locally.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'src/routeTree.gen.ts', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
