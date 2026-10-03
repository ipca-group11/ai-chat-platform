import { describe, expect, it } from "vitest";
import { filterBlockingViolations, formatViolations, type AxeResults } from "./axe-helper.js";

describe("filterBlockingViolations (AC-99)", () => {
  it("AC-99: keeps critical and serious violations", () => {
    const results: AxeResults = {
      violations: [
        { id: "color-contrast", impact: "serious", description: "d1", nodes: [] },
        { id: "label", impact: "critical", description: "d2", nodes: [] },
      ],
    };

    expect(filterBlockingViolations(results).map((v) => v.id)).toEqual([
      "color-contrast",
      "label",
    ]);
  });

  it("drops minor and moderate violations (AC-99)", () => {
    const results: AxeResults = {
      violations: [
        { id: "region", impact: "minor", description: "d1", nodes: [] },
        { id: "landmark", impact: "moderate", description: "d2", nodes: [] },
      ],
    };

    expect(filterBlockingViolations(results)).toEqual([]);
  });

  it("AC-99: treats a missing impact as non-blocking", () => {
    const results: AxeResults = {
      violations: [{ id: "unknown", impact: null, description: "d1", nodes: [] }],
    };

    expect(filterBlockingViolations(results)).toEqual([]);
  });

  it("returns an empty array when there are no violations (AC-99)", () => {
    expect(filterBlockingViolations({ violations: [] })).toEqual([]);
  });
});

describe("formatViolations (AC-99)", () => {
  it("AC-99: renders impact, id, description, and node targets for a readable failure message", () => {
    const message = formatViolations([
      {
        id: "label",
        impact: "critical",
        description: "Form elements must have labels",
        nodes: [{ target: ["#email"] }, { target: ["#password"] }],
      },
    ]);

    expect(message).toBe(
      "[critical] label: Form elements must have labels (#email, #password)",
    );
  });

  it("AC-99: returns an empty string for no violations", () => {
    expect(formatViolations([])).toBe("");
  });
});
