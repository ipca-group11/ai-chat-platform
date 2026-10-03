import { describe, expect, it } from "vitest";
import { coverageThresholds } from "./coverage-thresholds.js";

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
