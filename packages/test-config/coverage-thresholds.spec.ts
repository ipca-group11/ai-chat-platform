import { describe, expect, it } from "vitest";
import {
  appCoverageThresholds,
  coverageThresholds,
  e2eCoverageThresholds,
} from "./coverage-thresholds.js";

describe("coverageThresholds", () => {
  it("AC-97: defines an 80% threshold for lines, statements, functions, and branches", () => {
    expect(coverageThresholds).toEqual({
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 80,
    });
  });
});

describe("group thresholds", () => {
  it("AICHAT-81: apps use 75% branches, e2e helpers 70%, everything else 80%", () => {
    expect(appCoverageThresholds.branches).toBe(75);
    expect(e2eCoverageThresholds.branches).toBe(70);
    expect(appCoverageThresholds.lines).toBe(80);
    expect(e2eCoverageThresholds.functions).toBe(80);
  });
});
