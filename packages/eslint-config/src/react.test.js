import { describe, expect, it } from "vitest";
import base from "./base.js";
import react from "./react.js";
import { lintRuleIds } from "./test-utils/lint.js";

describe("react preset", () => {
  it("starts with every base entry and adds one JSX entry", () => {
    expect(react.slice(0, base.length)).toEqual(base);
    expect(react.length).toBe(base.length + 1);
  });

  it("scopes the React rules to jsx and tsx files and pins the React version", () => {
    const entry = react.at(-1);
    expect(entry.files).toEqual(["**/*.{jsx,tsx}"]);
    expect(entry.settings.react.version).toBe("19.3.0");
    expect(entry.languageOptions.parserOptions.ecmaFeatures.jsx).toBe(true);
  });

  it("switches off the rules a modern React setup does not need", () => {
    const { rules } = react.at(-1);
    expect(rules["react/react-in-jsx-scope"]).toBe("off");
    expect(rules["react/prop-types"]).toBe("off");
  });

  it("reports a hook called conditionally", async () => {
    const code = [
      "import { useState } from 'react';",
      "export function C({ on }: { on: boolean }) {",
      "  if (on) { useState(0); }",
      "  return <div />;",
      "}",
      "",
    ].join("\n");
    expect(await lintRuleIds(react, code, "src/C.tsx")).toContain("react-hooks/rules-of-hooks");
  });

  it("reports a list rendered without keys", async () => {
    const code = "export const L = () => <ul>{[1, 2].map((n) => <li>{n}</li>)}</ul>;\n";
    expect(await lintRuleIds(react, code, "src/L.tsx")).toContain("react/jsx-key");
  });

  it("accepts a clean component without importing React", async () => {
    const code = "export const Ok = ({ name }: { name: string }) => <p>{name}</p>;\n";
    expect(await lintRuleIds(react, code, "src/Ok.tsx")).toEqual([]);
  });

  it("does not apply the React rules to plain .ts files", async () => {
    const code = "export const x = [1, 2].map((n) => n * 2);\n";
    const ids = await lintRuleIds(react, code, "src/x.ts");
    expect(ids.some((id) => id?.startsWith("react"))).toBe(false);
  });
});
