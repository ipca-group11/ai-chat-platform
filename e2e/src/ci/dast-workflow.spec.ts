import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/dast.yml` (AICHAT-28): the ZAP baseline must run on the
 * agreed triggers against the mock stack, fail on a High alert, keep its reports as artifacts and
 * always tear the stack down. Marking the job as a required status check is a branch-protection
 * setting (unavailable on this private free-plan repository, HTTP 403), so it is a team rule
 * written in the workflow header; this suite only checks the workflow is wired to produce that check.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const workflow = read(".github/workflows/dast.yml");
const runner = read("testing/zap/run.sh");
const rules = read("testing/zap/rules.tsv");

/** The text of one job: from its `  name:` key to the next job or the end of the file. */
function job(name: string): string {
  const start = workflow.search(new RegExp(`^  ${name}:`, "m"));
  expect(start, `job ${name}`).toBeGreaterThanOrEqual(0);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^ {2}[a-z][\w-]*:/m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe("DAST CI workflow (AICHAT-28)", () => {
  it("runs on pull requests to main, on pushes to the integration branch and main, and on demand", () => {
    expect(workflow).toMatch(/^on:/m);
    expect(workflow).toMatch(/pull_request:\s*\n\s+branches: \[main\]/);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[integration\/testing-epics, main\]/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("pins the ZAP image to 2.17.0", () => {
    expect(workflow).toContain("ZAP_IMAGE: zaproxy/zap-stable:2.17.0");
    expect(runner).toContain("zaproxy/zap-stable:2.17.0");
  });

  it("starts the compose stack with the LLM mock and waits for it with a bound", () => {
    const baseline = job("baseline");
    expect(baseline).toMatch(/pnpm mock:up/);
    expect(baseline).toMatch(/seq 1 \d+/);
    expect(baseline).toContain("http://localhost:8000/");
  });

  it("fails the job on a High alert (fail_action) and warns on Medium", () => {
    expect(job("baseline")).toMatch(/FAIL_ACTION: "true"/);
    expect(runner).toMatch(/FAIL_ACTION:-true/);
    expect(runner).toMatch(/"\$status" = "1"/);
    const actions = (level: string) => rules.split("\n").filter((line) => line.split("\t")[1] === level).length;
    expect(actions("FAIL")).toBeGreaterThan(0);
    expect(actions("WARN")).toBeGreaterThan(0);
    expect(actions("IGNORE")).toBeGreaterThan(0);
  });

  it("scans signed in with the AJAX spider and the rules file", () => {
    expect(runner).toContain("scripts/dast/zap-session.ts");
    expect(runner).toMatch(/zap-baseline\.py .*-j /);
    expect(runner).toContain("-c rules.tsv");
  });

  it("masks the session cookie in the log", () => {
    expect(runner).toContain("::add-mask::");
  });

  it("keeps the HTML, JSON and Markdown reports as build artifacts even when the scan fails", () => {
    expect(job("baseline")).toMatch(/if:\s*always\(\)\s*\n\s+uses: actions\/upload-artifact@v4/);
    for (const ext of ["html", "json", "md"]) expect(workflow).toContain(`zap-results/baseline.${ext}`);
  });

  it("tears the stack down even if the job fails", () => {
    expect(job("baseline")).toMatch(/if:\s*always\(\)\s*\n\s+run: pnpm mock:down/);
  });

  it("documents the required-check team rule and never targets production", () => {
    expect(workflow).toContain('"dast / baseline"');
    expect(workflow).toMatch(/Production is never scanned/);
    expect(workflow).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i);
  });
});
