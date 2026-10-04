import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/redteam.yml` (AICHAT-26): the prompt injection run is weekly and on demand, never
 * blocks a merge, needs a repository secret and skips without it, keeps the report as an artifact, and carries a cost cap of
 * at most 2 USD that the code enforces too.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const workflow = read(".github/workflows/redteam.yml");
const budget = read("testing/promptfoo/src/budget.ts");

describe("red-team workflow (AICHAT-26)", () => {
  it("runs on a weekly schedule and on demand, never on a pull request or a push", () => {
    expect(workflow).toMatch(/^on:/m);
    const cron = /cron: "([^"]+)"/.exec(workflow)?.[1] ?? "";
    expect(cron.split(" ")).toHaveLength(5);
    expect(cron.split(" ")[4]).not.toBe("*");
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/^ {2}pull_request:/m);
    expect(workflow).not.toMatch(/^ {2}push:/m);
  });

  it("is non-blocking: the job and the promptfoo step may fail without failing the workflow", () => {
    expect(workflow).toMatch(/^ {4}continue-on-error: true/m);
    expect(workflow).toMatch(/id: run\n\s+if: [^\n]+\n\s+continue-on-error: true/);
    expect(workflow).toMatch(/NON-BLOCKING/);
  });

  it("uses the repository secret, reads it only to test for presence, and skips every later step without it", () => {
    expect(workflow).toContain("secrets.ANTHROPIC_API_KEY");
    expect(workflow).toContain('echo "present=false"');
    const guarded = workflow.split("\n").filter((line) => line.includes("steps.key.outputs.present == 'true'"));
    expect(guarded.length).toBeGreaterThanOrEqual(10);
    expect(workflow).not.toMatch(/echo[^\n]*\$\{?KEY\b/);
    expect(workflow).not.toMatch(/echo[^\n]*ANTHROPIC_API_KEY\}?\s*(>>|\|)/);
  });

  it("starts the throw-away test stack with the real provider and tears it down always", () => {
    expect(workflow).toContain("COMPOSE_FILE: compose.yaml:compose.redteam.yaml");
    expect(workflow).not.toContain("compose.mock.yaml");
    expect(workflow).toMatch(/if: steps\.key\.outputs\.present == 'true' && always\(\)\n\s+env:\n\s+COMPOSE_FILE[^\n]*\n\s+run: docker compose --profile llm down -v/);
    expect(workflow).toMatch(/seq 1 \d+/);
  });

  it("uploads the HTML and JSON report even when the run fails", () => {
    expect(workflow).toMatch(/if: steps\.key\.outputs\.present == 'true' && always\(\)\n\s+uses: actions\/upload-artifact@v4/);
    expect(workflow).toContain("redteam-results/report.html");
    expect(workflow).toContain("redteam-results/report.json");
  });

  it("checks the report for the key before the upload", () => {
    const check = workflow.indexOf("Check the report for the key");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(workflow.indexOf("Upload the report"));
    expect(workflow).toMatch(/grep -rqF -- "\$KEY"/);
  });

  it("never targets production", () => {
    expect(workflow).toContain("REDTEAM_APP_URL: http://localhost:8000");
    expect(workflow).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i);
  });
});

describe("red-team cost cap (AICHAT-26)", () => {
  it("is documented in the workflow header and set to at most 2 USD", () => {
    expect(workflow).toMatch(/COST CAP: 2 USD per run/);
    const cap = Number(/REDTEAM_BUDGET_USD: "([\d.]+)"/.exec(workflow)?.[1]);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(2);
  });

  it("is enforced by the code with the same maximum, and by a cost estimate before the run", () => {
    expect(budget).toContain("MAX_BUDGET_USD = 2");
    expect(workflow).toContain("node testing/promptfoo/src/estimate-cli.ts");
    expect(workflow.indexOf("Estimate the cost")).toBeLessThan(workflow.indexOf("Start the test stack"));
  });

  it("limits promptfoo to one call at a time without a cache", () => {
    const config = read("testing/promptfoo/promptfooconfig.yaml");
    expect(config).toMatch(/maxConcurrency: 1/);
    expect(config).toMatch(/cache: false/);
    expect(workflow).toContain("--no-cache");
  });
});
