import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile, repoRoot } from "./repo.ts";

const COMMITTED_DEV_TOKEN = "local-dev-only-internal-token-change-me";

/** Runs deploy/azure/check-deploy-secrets.sh with only the given variables set. */
function checkSecrets(env: Record<string, string>) {
  const result = spawnSync("bash", [join(repoRoot, "deploy/azure/check-deploy-secrets.sh")], {
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("AICHAT-251: deployments need their own INTERNAL_SERVICE_TOKEN", () => {
  const deployCompose = parse(readRepoFile("deploy/azure/docker-compose.yml"));
  const workflow = parse(readRepoFile(".github/workflows/deploy.yml"));
  const steps: { name?: string; run?: string; env?: Record<string, string> }[] = workflow.jobs.deploy.steps;

  it.each(["auth-service", "conversation-service"])(
    "%s gets the token in the deploy compose file, with no fallback value",
    (service) => {
      expect(deployCompose.services[service].environment.INTERNAL_SERVICE_TOKEN).toMatch(
        /^\$\{INTERNAL_SERVICE_TOKEN:\?[^}]*\}$/,
      );
    },
  );

  it("auth-service knows where conversation-service is, so account erasure is wired up", () => {
    expect(deployCompose.services["auth-service"].environment.CONVERSATION_SERVICE_URL).toBe(
      "http://conversation-service:4002",
    );
  });

  it("the deploy job runs in an environment and checks the secret before touching the VM", () => {
    expect(workflow.jobs.deploy.environment.name).toBe("production");
    const check = steps.findIndex((s) => s.run?.includes("check-deploy-secrets.sh"));
    const ssh = steps.findIndex((s) => s.name === "Configure SSH");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(ssh);
    expect(steps[check]?.env?.INTERNAL_SERVICE_TOKEN).toBe("${{ secrets.INTERNAL_SERVICE_TOKEN }}");
  });

  it("passes the token to the VM over stdin, not on the ssh command line", () => {
    const restart = steps.find((s) => s.name === "Pull and restart");
    expect(restart?.env?.INTERNAL_SERVICE_TOKEN).toBe("${{ secrets.INTERNAL_SERVICE_TOKEN }}");
    expect(restart?.run).toMatch(/printf '%s\\n' "\$INTERNAL_SERVICE_TOKEN" \| ssh /);
    expect(restart?.run).toContain("IFS= read -r INTERNAL_SERVICE_TOKEN && export INTERNAL_SERVICE_TOKEN");
    expect(restart?.run).not.toContain("secrets.INTERNAL_SERVICE_TOKEN");
  });

  it("the committed local default is the one the check rejects", () => {
    expect(readRepoFile("compose.yaml")).toContain(`\${INTERNAL_SERVICE_TOKEN:-${COMMITTED_DEV_TOKEN}}`);
  });

  describe("check-deploy-secrets.sh", () => {
    it("fails when the token is missing", () => {
      const { status, output } = checkSecrets({});
      expect(status).toBe(1);
      expect(output).toContain("INTERNAL_SERVICE_TOKEN is not set");
    });

    it("fails when the token is shorter than 32 characters", () => {
      const { status, output } = checkSecrets({ INTERNAL_SERVICE_TOKEN: "x".repeat(31) });
      expect(status).toBe(1);
      expect(output).toContain("shorter than 32");
    });

    it("fails when the token is the committed local default", () => {
      const { status, output } = checkSecrets({ INTERNAL_SERVICE_TOKEN: COMMITTED_DEV_TOKEN });
      expect(status).toBe(1);
      expect(output).toContain("committed to the repository");
    });

    it("passes with a generated token", () => {
      const { status, output } = checkSecrets({ INTERNAL_SERVICE_TOKEN: "a1".repeat(32) });
      expect(status).toBe(0);
      expect(output).toContain("Deployment secrets OK");
    });
  });
});
