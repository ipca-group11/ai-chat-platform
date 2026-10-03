import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import base from "./base.js";

/**
 * Preset for React frontend projects (`apps/shell`, `apps/mfe-*`, `packages/ui`):
 * base + React/JSX + hooks rules.
 */
const react = [
  ...base,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      // NOTE: "detect" crashes under ESLint 10's flat config because
      // eslint-plugin-react@7.37.5's version-detection helper still calls
      // the removed `context.getFilename()` API. Pin the version the
      // workspace actually uses instead (see apps/*/package.json).
      react: { version: "19.3.0" },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs["recommended-latest"].rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default react;
