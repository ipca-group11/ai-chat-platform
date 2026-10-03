import featureFolderBoundaries from "./rules/feature-folder-boundaries.ts";

/**
 * A tiny local ESLint plugin exposing this workspace's custom rule(s), so they can be
 * referenced as `"platform/feature-folder-boundaries"` from flat configs.
 */
const localPlugin = {
  meta: {
    name: "platform",
  },
  rules: {
    "feature-folder-boundaries": featureFolderBoundaries,
  },
};

export default localPlugin;
