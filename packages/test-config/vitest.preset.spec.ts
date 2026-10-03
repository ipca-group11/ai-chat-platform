import { describe, expect, it } from "vitest";
import { coveragePreset, vitestPreset } from "./vitest.preset.js";

describe("coveragePreset", () => {
  it("AC-97: uses the v8 provider and the shared 80% thresholds", () => {
    const preset = coveragePreset();
    expect(preset.provider).toBe("v8");
    expect(preset.thresholds).toEqual({
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 80,
    });
  });

  it("AC-97: excludes spec/test/story files by default", () => {
    const preset = coveragePreset();
    expect(preset.exclude).toContain("**/*.spec.ts");
    expect(preset.exclude).toContain("**/*.stories.tsx");
  });

  it("AC-97: appends caller-supplied excludes to the defaults instead of replacing them", () => {
    const preset = coveragePreset({ exclude: ["src/main.ts"] });
    expect(preset.exclude).toContain("src/main.ts");
    expect(preset.exclude).toContain("**/*.spec.ts");
  });

  it("AC-97: honors a caller-supplied include glob", () => {
    const preset = coveragePreset({ include: ["src/**/*.ts"] });
    expect(preset.include).toEqual(["src/**/*.ts"]);
  });

  it("AC-97: omits include when not supplied, letting Vitest default to instrumented files", () => {
    const preset = coveragePreset();
    expect(preset.include).toBeUndefined();
  });
});

describe("coveragePreset reporters and overrides", () => {
  it("AICHAT-81: emits text, lcov and json-summary reports", () => {
    expect(coveragePreset().reporter).toEqual(["text", "lcov", "json-summary"]);
  });

  it("AICHAT-81: merges threshold overrides over the 80% default", () => {
    expect(coveragePreset({ thresholds: { branches: 75 } }).thresholds).toEqual({
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 75,
    });
  });
});

describe("vitestPreset", () => {
  it("AC-97: defaults to a node test environment with the coverage preset applied", () => {
    const config = vitestPreset();
    expect(config.test?.environment).toBe("node");
    expect(config.test?.coverage?.thresholds).toEqual({
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 80,
    });
  });
});
