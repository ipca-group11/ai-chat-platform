import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile, readRepoJson } from "./repo.ts";

const ci = parse(readRepoFile(".github/workflows/ci.yml"));
// YAML 1.1 folds the bare `on:` key to the boolean `true`; the `yaml` package (YAML 1.2
// core schema) keeps it as the string "on", but read both so this test is robust to
// either parse.
const onTrigger = ci.on ?? ci.true;

describe("AC-12: CI runs `nx affected` for lint, typecheck, test, and build on every pull request", () => {
  it("AC-12: the workflow triggers on pull_request", () => {
    expect(onTrigger).toHaveProperty("pull_request");
  });

  it("AC-12: the affected job runs `nx affected` with lint, typecheck, test, and build", () => {
    const steps = ci.jobs.affected.steps;
    const nxStep = steps.find((s: { run?: unknown }) => typeof s.run === "string" && s.run.includes("nx affected"));
    expect(nxStep).toBeDefined();
    for (const target of ["lint", "typecheck", "test", "build"]) {
      expect(ci.env.NX_AFFECTED_TARGETS.split(" ")).toContain(target);
    }
    expect(nxStep.run).toMatch(/\$\{\{\s*env\.NX_AFFECTED_TARGETS\s*\}\}/);
  });

  it("AC-12: matches .factory/commands.json's `test` command targets exactly", () => {
    const commands = readRepoJson(".factory/commands.json");
    const targets = new Set(ci.env.NX_AFFECTED_TARGETS.split(" "));
    for (const target of ["lint", "typecheck", "test", "build"]) {
      expect(commands.test).toContain(target);
      expect(targets.has(target)).toBe(true);
    }
  });

  it("AC-12: checks out full history so `nx affected` can diff against the base branch", () => {
    const checkout = ci.jobs.affected.steps.find((s: { uses?: string }) => s.uses && s.uses.startsWith("actions/checkout"));
    expect(checkout.with["fetch-depth"]).toBe(0);
  });
});

describe("AICHAT-83: CI fails when a bundle exceeds its size-limit budget", () => {
  it("runs the `size` target in the same `nx affected` step as build", () => {
    expect(ci.env.NX_AFFECTED_TARGETS.split(" ")).toContain("size");
    expect(ci.env.NX_AFFECTED_TARGETS.split(" ").indexOf("size")).toBeGreaterThan(
      ci.env.NX_AFFECTED_TARGETS.split(" ").indexOf("build"),
    );
  });

  it("every app defines a `size` target and a size-limit config next to it", () => {
    for (const app of ["shell", "mfe-auth", "mfe-chat", "mfe-settings"]) {
      expect(readRepoJson(`apps/${app}/project.json`).targets.size.options.command).toBe("size-limit");
      expect(readRepoFile(`apps/${app}/.size-limit.ts`)).toMatch(/limit: '\d+ KB'/);
    }
  });

  it("nx.json makes `size` depend on `build`, so the budget is checked on a fresh build", () => {
    expect(readRepoJson("nx.json").targetDefaults.size.dependsOn).toContain("build");
  });

  it("is mirrored in .factory/commands.json", () => {
    expect(readRepoJson(".factory/commands.json").test).toContain(" size ");
  });
});

describe("AICHAT-101: pull requests show the bundle size change in the job summary", () => {
  const step = ci.jobs.affected.steps.find((s: { name?: string }) => s.name === "Bundle size change");

  it("has a step that runs only on pull requests and never fails the job", () => {
    expect(step).toBeDefined();
    expect(step.if).toContain("pull_request");
    expect(step["continue-on-error"]).toBe(true);
  });

  it("snapshots head and base builds and reports the difference with scripts/ci/bundle-size.ts", () => {
    expect(step.run).toMatch(/bundle-size\.ts snapshot .*head-sizes\.json/);
    expect(step.run).toMatch(/bundle-size\.ts snapshot --root .*base-sizes\.json/);
    expect(step.run).toMatch(/bundle-size\.ts report .*base-sizes\.json.* .*head-sizes\.json/);
    expect(step.run).toContain("$NX_BASE");
  });
});

describe("AC-13: CI fails the build if any project reports a lint or typecheck error", () => {
  it("AC-13: the `nx affected` step is a normal (non-continue-on-error) step", () => {
    const nxStep = ci.jobs.affected.steps.find(
      (s: { run?: unknown }) => typeof s.run === "string" && s.run.includes("nx affected"),
    );
    expect(nxStep["continue-on-error"]).toBeFalsy();
  });

  it("AC-13: `affected` checks the code, `test-db` runs the database tests (AICHAT-116) and `source-sbom` only produces the source SBOM (AICHAT-108)", () => {
    expect(Object.keys(ci.jobs)).toEqual(["affected", "test-db", "source-sbom"]);
  });
});

describe("AC-14: Nx task results are cached in CI to avoid re-running unaffected projects", () => {
  it("AC-14: a cache step persists the Nx computation cache directory", () => {
    const cacheStep = ci.jobs.affected.steps.find((s: { uses?: string }) => s.uses && s.uses.startsWith("actions/cache"));
    expect(cacheStep).toBeDefined();
    expect(cacheStep.with.path).toBe(".nx/cache");
  });

  it("AC-14: the cache key is derived from nx.json and the lockfile so it invalidates on config changes", () => {
    const cacheStep = ci.jobs.affected.steps.find((s: { uses?: string }) => s.uses && s.uses.startsWith("actions/cache"));
    expect(cacheStep.with.key).toMatch(/hashFiles\('nx\.json', 'pnpm-lock\.yaml'\)/);
  });
});

describe("AICHAT-116: database tests run in CI on a real Postgres, apart from the unit tests", () => {
  const services = ["auth-service", "conversation-service"];

  it("has a test-db job that runs the test-db target for both services that own a Prisma schema", () => {
    const run = ci.jobs["test-db"].steps.map((s: { run?: string }) => s.run ?? "").join("\n");
    expect(run).toMatch(/nx run-many -t test-db -p auth-service,conversation-service/);
  });

  it("pulls the same Postgres image that compose.yaml uses", () => {
    const image = readRepoFile("compose.yaml").match(/image:\s*(postgres:\S+)/)?.[1];
    const run = ci.jobs["test-db"].steps.map((s: { run?: string }) => s.run ?? "").join("\n");
    expect(image).toBeDefined();
    expect(run).toContain(`docker pull ${image}`);
  });

  it.each(services)("%s: test-db is its own target and the unit test target stays free of Docker", (service) => {
    const targets = readRepoJson(`services/${service}/project.json`).targets;
    expect(targets["test-db"].options.command).toContain("vitest.db.config.ts");
    expect(targets.test.options.command).not.toContain("vitest.db.config.ts");
    expect(readRepoFile(`services/${service}/vitest.config.ts`)).toContain('"src/**/*.db.spec.ts"');
    expect(readRepoFile(`services/${service}/vitest.db.config.ts`)).toContain("postgres-global-setup");
  });
});
