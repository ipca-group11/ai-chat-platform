// Minimal local flat ESLint config for packages/ui.
//
// NOTE: `packages/eslint-config` (owned by the platform-foundation pod) will provide a
// shared flat config. Once it lands, this file should be replaced with a thin wrapper
// that extends it, per docs/pods/design-system/PLAN.md.
//
// NOTE: this package's `typescript` devDependency is pinned to `6.0.3`, not the
// `7.0.2` mandated by STACK.md, because `typescript-eslint@8.70.1` (the latest
// release as of this build) hard-crashes on TS 7's compiler API — see
// https://github.com/typescript-eslint/typescript-eslint/issues/10940. This is the
// same known incompatibility documented in
// `docs/pods/platform-foundation/CONVENTIONS.md` §"TypeScript 7.0.2 / typescript-eslint
// compatibility", where `@platform/eslint-config` isolates its own `typescript@6.0.3`
// devDependency for the same reason without affecting consumers' own `tsc`. Because
// this package doesn't yet consume `@platform/eslint-config` (see note above), it
// can't get that isolation "for free" via a separate package boundary, so the pin
// applies package-wide here; `typecheck`/`build` (which only run `tsc`, not
// `typescript-eslint`) are unaffected by the TS 6 vs 7 difference for this codebase.
// Revert to `typescript@7.0.2` once this file is rewired to extend
// `@platform/eslint-config` (which brings its own isolated pin).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'storybook-static', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
