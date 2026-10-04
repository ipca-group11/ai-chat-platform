import { describe, expect, it } from "vitest";
import { describeEstimate } from "./estimate-cli.ts";

describe("describeEstimate", () => {
  it("lists the attacks that run, leaves out the known gaps and stays within the cap", () => {
    const { text, withinCap } = describeEstimate({}, 2);
    expect(withinCap).toBe(true);
    expect(text).toContain("A4");
    expect(text).not.toContain("A2a");
    expect(text).toContain("9 attacks x 2 = 18 runs");
    expect(text).toContain("within the cap");
  });

  it("adds the known gaps when asked and respects REDTEAM_SURFACES", () => {
    expect(describeEstimate({ REDTEAM_INCLUDE_GAPS: "1" }, 1).text).toContain("A2a");
    expect(describeEstimate({ REDTEAM_SURFACES: "web" }, 1).text).toContain("3 attacks x 1 = 3 runs");
  });

  it("says when the estimate is above a lowered cap", () => {
    const { text, withinCap } = describeEstimate({ REDTEAM_BUDGET_USD: "0.01" }, 1);
    expect(withinCap).toBe(false);
    expect(text).toContain("ABOVE THE CAP");
  });
});
