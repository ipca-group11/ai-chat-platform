import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/api-schema.yml` (AICHAT-187): Schemathesis runs on every pull
 * request against both services with the generated specs, fails the job on any failed check, keeps the
 * JUnit reports and always tears the stack down. Making the job a *required* check is a
 * branch-protection setting outside the repository (team rule written in the workflow header).
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const workflow = read(".github/workflows/api-schema.yml");
const runner = read("testing/schemathesis/run.sh");

describe("Schemathesis CI workflow (AICHAT-187)", () => {
  it("runs on every pull request, on pushes to the integration branch and main, and on demand", () => {
    expect(workflow).toMatch(/^on:\n {2}pull_request:\n/m);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[integration\/testing-epics, main\]/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("pins the Schemathesis image in the workflow and the runner", () => {
    expect(workflow).toMatch(/ST_IMAGE: schemathesis\/schemathesis:\d+\.\d+\.\d+\n/);
    expect(runner).toMatch(/schemathesis\/schemathesis:\d+\.\d+\.\d+/);
  });

  it("fuzzes both services from their generated specs with the three agreed checks, signed in", () => {
    expect(runner).toContain("services/$name/openapi.json");
    expect(runner).toMatch(/run_service auth-service /);
    expect(runner).toMatch(/run_service conversation-service /);
    expect(runner).toContain("--checks not_a_server_error,status_code_conformance,response_schema_conformance");
    expect(runner).toMatch(/--header "Cookie: \$cookie"/);
    expect(runner).toContain("::add-mask::");
  });

  it("only leaves out the destructive and never-ending operations", () => {
    const excluded = [...runner.matchAll(/--exclude-operation-id (\w+)/g)].map((m) => m[1]).sort();
    expect(excluded).toEqual(["deleteAccount", "eraseUser", "streamChat"]);
  });

  it("raises the auth-service rate limit only on this throw-away stack", () => {
    expect(workflow).toMatch(/RATE_LIMIT_MAX: "\d+"/);
    expect(read("compose.yaml")).toContain("RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-300}");
  });

  it("fails the job on a failed check and keeps the JUnit reports even then", () => {
    expect(runner).toMatch(/exit \$status/);
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow).toMatch(/if:\s*always\(\)\s*\n\s+uses: actions\/upload-artifact@v4/);
    expect(workflow).toContain("schemathesis-results/*.xml");
  });

  it("tears the stack down even if the job fails, and never targets production", () => {
    expect(workflow).toMatch(/if:\s*always\(\)\s*\n\s+run: pnpm mock:down/);
    expect(workflow).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}\//i);
  });
});
