// Dogfoods this package's own `node` preset against its own source.
import node from "@platform/eslint-config/node";

export default [
  ...node,
  {
    rules: {
      // Test files assert on repo-root config file contents; not worth typing precisely.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
