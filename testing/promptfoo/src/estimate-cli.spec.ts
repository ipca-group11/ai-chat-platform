import { describe, expect, it } from "vitest";
import { describeEstimate } from "./estimate-cli.ts";

describe("describeEstimate", () => {
  it("lists every attack, the file attacks included, and stays within the cap", () => {
    const { text, withinCap } = describeEstimate({}, 2);
    expect(withinCap).toBe(true);
    expect(text).toContain("A4");
    expect(text).toContain("A2a");
    expect(text).toContain("11 attacks x 2 = 22 runs");
    expect(text).toContain("within the cap");
  });

  it("respects REDTEAM_SURFACES", () => {
    expect(describeEstimate({ REDTEAM_SURFACES: "web" }, 1).text).toContain("3 attacks x 1 = 3 runs");
    expect(describeEstimate({ REDTEAM_SURFACES: "file" }, 1).text).toContain("2 attacks x 1 = 2 runs");
  });

  it("says when the estimate is above a lowered cap", () => {
    const { text, withinCap } = describeEstimate({ REDTEAM_BUDGET_USD: "0.01" }, 1);
    expect(withinCap).toBe(false);
    expect(text).toContain("ABOVE THE CAP");
  });
});
