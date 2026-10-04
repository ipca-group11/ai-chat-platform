import { RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import localPlugin from "./local-plugin.ts";
import featureFolderBoundaries from "./rules/feature-folder-boundaries.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

describe("local plugin", () => {
  it("is named platform", () => {
    expect(localPlugin.meta.name).toBe("platform");
  });

  it("exposes the feature-folder-boundaries rule", () => {
    expect(Object.keys(localPlugin.rules)).toEqual(["feature-folder-boundaries"]);
    expect(localPlugin.rules["feature-folder-boundaries"]).toBe(featureFolderBoundaries);
  });
});

// The rule is resolved through the plugin object, the way a flat config would use it.
new RuleTester({ languageOptions: { ecmaVersion: 2023, sourceType: "module" } }).run(
  "platform/feature-folder-boundaries (via the plugin)",
  localPlugin.rules["feature-folder-boundaries"],
  {
    valid: [
      {
        code: "import { a } from '../../shared/a';",
        filename: "/repo/apps/mfe-chat/src/features/x/X.tsx",
      },
    ],
    invalid: [
      {
        code: "import { a } from '../y/hooks/useA';",
        filename: "/repo/apps/mfe-chat/src/features/x/X.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
    ],
  },
);
