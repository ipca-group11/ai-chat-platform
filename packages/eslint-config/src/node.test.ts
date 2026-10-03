import { describe, expect, it } from "vitest";
import base from "./base.ts";
import node from "./node.ts";
import { lintRuleIds } from "./test-utils/lint.ts";

describe("node preset", () => {
  it("starts with every base entry, in order", () => {
    expect(node.slice(0, base.length)).toEqual(base);
    expect(node.length).toBe(base.length + 1);
  });

  it("declares the Node globals as read-only", () => {
    const { globals } = node.at(-1)?.languageOptions ?? {};
    expect(globals).toEqual({ process: "readonly", __dirname: "readonly", __filename: "readonly" });
  });

  it("allows console output, which the base preset only warns about", async () => {
    expect(await lintRuleIds(base, "console.log(1);\n")).toContain("no-console");
    expect(await lintRuleIds(node, "console.log(1);\n")).not.toContain("no-console");
  });

  it("does not report process or __dirname as undefined", async () => {
    const ids = await lintRuleIds(node, "export const a = [process.env, __dirname, __filename];\n", "src/fixture.js");
    expect(ids).not.toContain("no-undef");
  });

  it("keeps the base rules on", async () => {
    expect(await lintRuleIds(node, "const unused = 1;\n")).toContain("@typescript-eslint/no-unused-vars");
  });
});
