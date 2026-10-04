import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { markdownFor } from "./report-cli.ts";
import { summarise, toMarkdown, type EvalFile } from "./report.ts";

const file: EvalFile = {
  results: {
    results: [
      { success: true, failureReason: 0, vars: { attack: "A7a" }, testCase: { metadata: { attack: "A7a", surface: "direct" } }, gradingResult: { componentResults: [{ pass: true }] } },
      {
        success: false,
        failureReason: 1,
        error: "long | text",
        testCase: { metadata: { attack: "A4", surface: "web" } },
        gradingResult: {
          componentResults: [
            { pass: true, assertion: { metric: "canary" } },
            { pass: false, reason: "fetched https://attacker.example/log | x", assertion: { metric: "fetched-url" } },
            { pass: false, assertion: { metric: "rubric" } },
          ],
        },
      },
      { success: false, failureReason: 2, error: "known gap, not counted as a pass: Text attachments", vars: { attack: "A2a" }, gradingResult: null },
      { success: false, failureReason: 2, error: "create chat failed: HTTP 401", vars: { attack: "A1" } },
      { success: false, vars: {}, gradingResult: { componentResults: [{ pass: false }] } },
    ],
  },
};

describe("summarise", () => {
  const rows = summarise(file);

  it("marks a pass, a failed assertion with its checks, a known gap and a provider error", () => {
    expect(rows.map((r) => [r.attack, r.verdict])).toEqual([
      ["A7a", "pass"],
      ["A4", "fail"],
      ["A2a", "known-gap"],
      ["A1", "error"],
      ["?", "fail"],
    ]);
    expect(rows[1]).toMatchObject({ surface: "web", failedChecks: ["fetched-url", "rubric"], detail: "fetched https://attacker.example/log / x" });
    expect(rows[4]).toMatchObject({ failedChecks: ["check"], detail: "an assertion failed" });
  });

  it("returns no rows for an empty file", () => {
    expect(summarise({})).toEqual([]);
  });
});

describe("toMarkdown", () => {
  it("writes a table and the totals, saying that a known gap is not a pass", () => {
    const text = toMarkdown(summarise(file));
    expect(text).toContain("| A4 | web | fail | fetched-url, rubric |");
    expect(text).toContain("5 runs: 1 pass, 2 fail, 1 error, 1 known gap (not counted as a pass).");
  });
});

describe("markdownFor", () => {
  it("reads a report file and says why when it cannot", () => {
    const dir = mkdtempSync(join(tmpdir(), "report-"));
    const path = join(dir, "report.json");
    writeFileSync(path, JSON.stringify(file));
    expect(markdownFor(path)).toContain("| A7a | direct | pass |");
    expect(markdownFor(join(dir, "missing.json"))).toMatch(/^No red-team summary: /);
  });
});
