import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the contract-test jobs of `.github/workflows/ci.yml` (AICHAT-182): the
 * consumers write the pacts, the providers verify those same pacts in the same run, and a
 * failure on either side fails the pull request. Making the jobs *required* checks is a
 * branch-protection setting outside the repository; this suite checks the jobs that produce them.
 */

const workflow = readFileSync(fileURLToPath(new URL("../../../.github/workflows/ci.yml", import.meta.url)), "utf-8");

/** The text of one job, from its key to the next job (or the end of the file). */
function job(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  expect(start, `job ${name} exists`).toBeGreaterThan(-1);
  const next = workflow.slice(start + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
}

describe("contract tests in CI (AICHAT-182)", () => {
  it("runs on every pull request", () => {
    expect(workflow).toMatch(/^on:\n {2}pull_request:/m);
  });

  it("consumer job: runs every consumer's pact tests, without the cache, and uploads the pacts", () => {
    const consumer = job("contracts-consumer");
    expect(consumer).toMatch(/nx run-many -t pact:consumer --skip-nx-cache/);
    expect(consumer).toContain("actions/upload-artifact@v4");
    expect(consumer).toMatch(/name: pacts\n\s+path: pacts\//);
    expect(consumer).toMatch(/if-no-files-found: error/);
  });

  it("provider job: waits for the consumers, downloads the same run's pacts and verifies both services", () => {
    const provider = job("contracts-provider");
    expect(provider).toMatch(/needs: contracts-consumer/);
    expect(provider).toContain("actions/download-artifact@v4");
    expect(provider).toMatch(/name: pacts\n\s+path: pacts/);
    expect(provider).toMatch(/provider: \[auth-service, conversation-service\]/);
    expect(provider).toMatch(/nx run \$\{\{ matrix\.provider \}\}:pact:verify --skip-nx-cache/);
  });

  it("uses no Pact Broker: the pacts never leave the run (AICHAT-177)", () => {
    expect(workflow).not.toMatch(/PACT_BROKER/);
  });

  it("failures are not swallowed", () => {
    expect(job("contracts-consumer")).not.toMatch(/continue-on-error/);
    expect(job("contracts-provider")).not.toMatch(/continue-on-error/);
  });
});
