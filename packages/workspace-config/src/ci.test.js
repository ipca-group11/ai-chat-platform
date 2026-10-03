import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile, readRepoJson } from "./repo.js";

const ci = parse(readRepoFile(".github/workflows/ci.yml"));
// YAML 1.1 folds the bare `on:` key to the boolean `true`; the `yaml` package (YAML 1.2
// core schema) keeps it as the string "on", but read both so this test is robust to
// either parse.
const onTrigger = ci.on ?? ci.true ?? ci[true];

describe("AC-12: CI runs `nx affected` for lint, typecheck, test, and build on every pull request", () => {
  it("AC-12: the workflow triggers on pull_request", () => {
    expect(onTrigger).toHaveProperty("pull_request");
  });

  it("AC-12: the affected job runs `nx affected` with lint, typecheck, test, and build", () => {
    const steps = ci.jobs.affected.steps;
    const nxStep = steps.find((s) => typeof s.run === "string" && s.run.includes("nx affected"));
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
    const checkout = ci.jobs.affected.steps.find((s) => s.uses && s.uses.startsWith("actions/checkout"));
    expect(checkout.with["fetch-depth"]).toBe(0);
  });
});

describe("AC-13: CI fails the build if any project reports a lint or typecheck error", () => {
  it("AC-13: the `nx affected` step is a normal (non-continue-on-error) step", () => {
    const nxStep = ci.jobs.affected.steps.find(
      (s) => typeof s.run === "string" && s.run.includes("nx affected"),
    );
    expect(nxStep["continue-on-error"]).toBeFalsy();
  });

  it("AC-13: the workflow has a single job so a lint/typecheck failure fails the whole run", () => {
    expect(Object.keys(ci.jobs)).toEqual(["affected"]);
  });
});

describe("AC-14: Nx task results are cached in CI to avoid re-running unaffected projects", () => {
  it("AC-14: a cache step persists the Nx computation cache directory", () => {
    const cacheStep = ci.jobs.affected.steps.find((s) => s.uses && s.uses.startsWith("actions/cache"));
    expect(cacheStep).toBeDefined();
    expect(cacheStep.with.path).toBe(".nx/cache");
  });

  it("AC-14: the cache key is derived from nx.json and the lockfile so it invalidates on config changes", () => {
    const cacheStep = ci.jobs.affected.steps.find((s) => s.uses && s.uses.startsWith("actions/cache"));
    expect(cacheStep.with.key).toMatch(/hashFiles\('nx\.json', 'pnpm-lock\.yaml'\)/);
  });
});
