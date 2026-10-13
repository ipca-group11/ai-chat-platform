import { expect, test } from "@playwright/test";
import { filterBlockingViolations, formatViolations, reportFileName, summarizeScans, wcagTags, type AxeResults } from "./axe.js";

/** The decisions inside the axe helper (AICHAT-173). Node only, no browser and no stack. */

const violation = (id: string, impact: AxeResults["violations"][number]["impact"]) => ({
  id,
  impact,
  description: `${id} description`,
  nodes: [],
});

test.describe("filterBlockingViolations", () => {
  test("keeps serious and critical violations", () => {
    const results = { violations: [violation("color-contrast", "serious"), violation("label", "critical")] };
    expect(filterBlockingViolations(results).map((v) => v.id)).toEqual(["color-contrast", "label"]);
  });

  test("drops minor and moderate violations: they are reported, not blocking", () => {
    const results = { violations: [violation("region", "minor"), violation("landmark-unique", "moderate")] };
    expect(filterBlockingViolations(results)).toEqual([]);
  });

  test("a violation without an impact does not block", () => {
    expect(filterBlockingViolations({ violations: [violation("unknown", null), violation("unset", undefined)] })).toEqual([]);
  });
});

test.describe("formatViolations", () => {
  test("names the impact, the rule and every failing element", () => {
    const message = formatViolations([
      {
        id: "label",
        impact: "critical",
        description: "Form elements must have labels",
        nodes: [{ target: ["#email"] }, { target: ["#password"] }],
      },
    ]);
    expect(message).toBe("[critical] label: Form elements must have labels (#email, #password)");
  });

  test("is empty when there is nothing to report", () => {
    expect(formatViolations([])).toBe("");
  });
});

test("the scan runs WCAG 2.2 AA (with 2.0 and 2.1) and not the best-practice rules", () => {
  expect(wcagTags).toEqual(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  expect(wcagTags).not.toContain("best-practice");
});

test("summarizeScans lists each rule once, blocking ones first, with the scans it failed in", () => {
  const table = summarizeScans([
    { label: "login · dark", violations: [violation("region", "moderate"), violation("color-contrast", "serious")] },
    { label: "chat · light", violations: [violation("color-contrast", "serious")] },
    { label: "settings · light", violations: [] },
  ]);
  const rows = table.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Rule"));
  expect(table).toContain("3 scans, 2 rules with violations");
  expect(rows).toEqual([
    "| color-contrast | serious | yes | 0 | chat · light<br>login · dark |",
    "| region | moderate | no | 0 | login · dark |",
  ]);
});

test("reportFileName turns the scan label into a safe file name", () => {
  expect(reportFileName("Chat · members dialog · dark")).toBe("chat-members-dialog-dark.json");
  expect(reportFileName("/login: wrong password (light)")).toBe("login-wrong-password-light.json");
});
