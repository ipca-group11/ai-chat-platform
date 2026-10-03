import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/e2e.yml` (O8, AC-100): the e2e suite must run in
 * CI on demand (`workflow_dispatch`); since 2026-10-03 it no longer runs on every pull request
 * because the full suite is too slow. Actually marking the job as a *required* status check is a repo-admin
 * branch-protection action outside any pod's file ownership (see PLAN.md "Known gaps") and
 * isn't something a workflow-file test can assert; this suite only verifies the workflow
 * itself is wired up correctly to produce that status check.
 */

const workflowPath = fileURLToPath(new URL("../../../.github/workflows/e2e.yml", import.meta.url));
const workflow = readFileSync(workflowPath, "utf-8");

describe("e2e CI workflow (AC-100)", () => {
  it("runs only on demand (team decision 2026-10-03: the full suite is too slow for every pull request)", () => {
    expect(workflow).toMatch(/^on:/m);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
    expect(workflow).not.toMatch(/^\s+push:/m);
  });

  it("AC-100: brings up the full docker-compose stack before testing", () => {
    // `pnpm mock:up` is `docker compose --profile llm up -d --build` (scripts/mock-compose.sh).
    expect(workflow).toMatch(/pnpm mock:up/);
  });

  it("AICHAT-153: runs the stack with the llm profile, so the chat flows hit the mock and need no real key", () => {
    expect(workflow).toContain("profile llm");
    expect(workflow).not.toMatch(/secrets\.ANTHROPIC_API_KEY/);
    const script = readFileSync(fileURLToPath(new URL("../../../scripts/mock-compose.sh", import.meta.url)), "utf-8");
    expect(script).toMatch(/docker compose --profile "\$profile" up -d --build/);
  });

  it("AC-100: waits for the stack to become healthy before running specs", () => {
    expect(workflow).toContain("wait-for-stack");
  });

  it("AC-100: runs the Playwright e2e Nx target covering UC1-UC8", () => {
    expect(workflow).toMatch(/nx run e2e:e2e/);
  });

  it("AC-100: uploads the Playwright report as a build artifact on failure", () => {
    expect(workflow).toMatch(/if:\s*failure\(\)/);
    expect(workflow).toContain("upload-artifact");
  });

  it("AC-100: tears the stack down even if the job fails", () => {
    expect(workflow).toMatch(/if:\s*always\(\)/);
    expect(workflow).toMatch(/pnpm mock:down/);
  });
});
