import { describe, expect, it } from "vitest";
import base from "./base.ts";
import { lintRuleIds } from "./test-utils/lint.ts";

const ruleConfig = (name: string): unknown => base.find((entry) => entry.rules?.[name])?.rules?.[name];

type NxBoundaries = [string, { depConstraints: Array<{ sourceTag: string; onlyDependOnLibsWithTags: string[] }> }];

describe("base preset", () => {
  it("is a flat config array that registers the nx and local platform plugins", () => {
    expect(Array.isArray(base)).toBe(true);
    const plugins = base.find((entry) => entry.plugins?.platform)?.plugins;
    expect(Object.keys(plugins ?? {})).toEqual(expect.arrayContaining(["@nx", "platform"]));
  });

  it("ignores build output and dependency folders", () => {
    const ignores = base.find((entry) => entry.ignores)?.ignores;
    expect(ignores).toEqual(
      expect.arrayContaining(["**/dist/**", "**/coverage/**", "**/node_modules/**", "**/storybook-static/**"]),
    );
  });

  it("enforces module boundaries between apps, services and packages", () => {
    const [severity, options] = ruleConfig("@nx/enforce-module-boundaries") as NxBoundaries;
    expect(severity).toBe("error");
    const constraints = Object.fromEntries(options.depConstraints.map((c) => [c.sourceTag, c.onlyDependOnLibsWithTags]));
    expect(constraints).toEqual({
      "type:app": ["type:package"],
      "type:service": ["type:package"],
      "type:package": ["type:package"],
    });
  });

  it("turns the local feature-folder rule on as an error", () => {
    expect(ruleConfig("platform/feature-folder-boundaries")).toBe("error");
  });

  it("reports an unused variable, but not one that starts with an underscore", async () => {
    expect(await lintRuleIds(base, "const unused = 1;\n")).toContain("@typescript-eslint/no-unused-vars");
    expect(await lintRuleIds(base, "const _unused = 1;\n")).not.toContain("@typescript-eslint/no-unused-vars");
  });

  it("ignores an unused argument that starts with an underscore", async () => {
    const ids = await lintRuleIds(base, "export function f(_a: number, b: number) { return b; }\n");
    expect(ids).not.toContain("@typescript-eslint/no-unused-vars");
  });

  it("asks for `import type` when an import is only used as a type", async () => {
    const code = "import { Foo } from './foo';\nexport const a = null as unknown as Foo;\n";
    expect(await lintRuleIds(base, code)).toContain("@typescript-eslint/consistent-type-imports");
    const fixed = "import type { Foo } from './foo';\nexport const a = null as unknown as Foo;\n";
    expect(await lintRuleIds(base, fixed)).not.toContain("@typescript-eslint/consistent-type-imports");
  });

  it("warns on console.log but allows console.warn and console.error", async () => {
    expect(await lintRuleIds(base, "console.log(1);\n")).toContain("no-console");
    expect(await lintRuleIds(base, "console.warn(1);\nconsole.error(2);\n")).not.toContain("no-console");
  });

  it("applies the typescript-eslint recommended rules (no explicit any)", async () => {
    expect(await lintRuleIds(base, "export const a: any = 1;\n")).toContain("@typescript-eslint/no-explicit-any");
  });

  it("applies the ESLint recommended rules", async () => {
    expect(await lintRuleIds(base, "if (1) {}\nexport const a = 1;\nexport const a2 = a;\ndebugger;\n")).toContain("no-debugger");
  });

  it("flags a deep import into another feature through the local rule", async () => {
    const ids = await lintRuleIds(
      base,
      "export { thing } from '../other/hooks/useThing';\n",
      "src/features/mine/index.ts",
    );
    expect(ids).toContain("platform/feature-folder-boundaries");
  });

  it("accepts an import of another feature's public API", async () => {
    const ids = await lintRuleIds(base, "export { thing } from '../other';\n", "src/features/mine/index.ts");
    expect(ids).not.toContain("platform/feature-folder-boundaries");
  });
});
