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

describe("DAST weekly API scan (AICHAT-121)", () => {
  it("runs on a weekly schedule and on demand, never on a pull request", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s+- cron: "[^"]+"/);
    const cron = /cron: "([^"]+)"/.exec(workflow)?.[1] ?? "";
    expect(cron.split(" ")).toHaveLength(5);
    expect(cron.split(" ")[4]).not.toBe("*");
    expect(job("api-scan")).toMatch(/if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
    expect(job("baseline")).toMatch(/if: github\.event_name != 'schedule'/);
  });

  it("scans the OpenAPI file with zap-api-scan.py and keeps the reports", () => {
    expect(job("api-scan")).toContain("run: bash testing/zap/run.sh api");
    expect(runner).toMatch(/zap-api-scan\.py -t \/zap\/wrk\/openapi\.yaml -f openapi/);
    expect(job("api-scan")).toMatch(/if:\s*always\(\)\s*\n\s+uses: actions\/upload-artifact@v4/);
    expect(job("api-scan")).toContain("zap-results/api.html");
    expect(job("api-scan")).toMatch(/if:\s*always\(\)\s*\n\s+run: pnpm mock:down/);
  });

  it("sets the active High rules to FAIL", () => {
    const failing = rules.split("\n").filter((line) => line.split("\t")[1] === "FAIL").map((line) => line.split("\t")[0]);
    for (const id of ["40012", "40018", "90020"]) expect(failing).toContain(id);
  });
});

describe("OpenAPI file for the API scan (AICHAT-121)", () => {
  const spec = read("testing/zap/openapi.yaml");
  const normalise = (path: string): string => path.replace(/:[A-Za-z]+/g, "{}").replace(/\{[^}]+\}/g, "{}");

  /** `METHOD /path` of every operation in the spec, with parameters collapsed to `{}`. */
  function specOperations(): Set<string> {
    const operations = new Set<string>();
    let path = "";
    for (const line of spec.split("\n")) {
      const pathMatch = /^ {2}(\/\S*):\s*$/.exec(line);
      if (pathMatch) path = normalise(pathMatch[1] ?? "");
      const method = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
      if (method && path) operations.add(`${(method[1] ?? "").toUpperCase()} ${path}`);
    }
    return operations;
  }

  /** Operations of an Express router file mounted at `prefix`, as seen through the shell. */
  function routerOperations(file: string, mount: string): string[] {
    const source = read(file);
    return [...source.matchAll(/router\.(get|post|put|patch|delete)\("([^"]*)"/g)].map(
      (m) => `${(m[1] ?? "").toUpperCase()} ${normalise(mount + (m[2] === "/" ? "" : (m[2] ?? "")))}`,
    );
  }

  it("is OpenAPI 3 and uses the shell as the server", () => {
    expect(spec).toMatch(/^openapi: 3\./m);
    expect(spec).toMatch(/servers:\s*\n\s+- url: http:\/\/localhost:8000/);
  });

  it("lists every conversation-service route under /api/chats, except the endless stream", () => {
    const features = "services/conversation-service/src/features";
    const expected = [
      ...routerOperations(`${features}/chats/routes.ts`, "/api/chats"),
      ...routerOperations(`${features}/messages/routes.ts`, "/api/chats"),
      ...routerOperations(`${features}/attachments/routes.ts`, "/api/chats"),
    ];
    expect(expected.length).toBeGreaterThan(10);
    const documented = specOperations();
    expect(expected.filter((operation) => !documented.has(operation))).toEqual([]);
  });

  it("lists every auth-service route under /auth", () => {
    const features = "services/auth-service/src/features";
    const source = [read(`${features}/register/api.ts`), read(`${features}/session/api.ts`)].join("\n");
    const expected = [...source.matchAll(/Router\.(get|post)\("([^"]*)"/g)].map((m) => `${(m[1] ?? "").toUpperCase()} /auth${m[2] ?? ""}`);
    expect(expected).toHaveLength(5);
    const documented = specOperations();
    expect(expected.filter((operation) => !documented.has(operation))).toEqual([]);
  });
});
