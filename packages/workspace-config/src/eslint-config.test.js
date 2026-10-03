import { describe, expect, it } from "vitest";
import { base, node, react } from "@platform/eslint-config";

describe("AC-9: packages/eslint-config provides a flat ESLint config with typescript-eslint used by every project", () => {
  it.each([
    ["base", base],
    ["react", react],
    ["node", node],
  ])("AC-9: the %s preset is a flat-config array", (_name, preset) => {
    expect(Array.isArray(preset)).toBe(true);
    expect(preset.length).toBeGreaterThan(0);
  });

  it("AC-9: base wires up typescript-eslint's recommended rules", () => {
    const hasTsRuleConfig = base.some(
      (cfg) => cfg.rules && Object.keys(cfg.rules).some((rule) => rule.startsWith("@typescript-eslint/")),
    );
    expect(hasTsRuleConfig).toBe(true);
  });

  it("AC-9: react and node presets both extend base (spread it first)", () => {
    expect(react.length).toBeGreaterThan(base.length);
    expect(node.length).toBeGreaterThan(base.length);
  });

  it("AC-9: react preset adds React/JSX rules for apps/shell, apps/mfe-*, and packages/ui", () => {
    const reactCfg = react.find((cfg) => cfg.plugins && cfg.plugins.react);
    expect(reactCfg).toBeDefined();
    expect(reactCfg.plugins["react-hooks"]).toBeDefined();
  });
});
