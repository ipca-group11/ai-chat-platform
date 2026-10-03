import { describe, expect, it } from "vitest";
import {
  checkProject,
  COVERAGE_EXEMPT,
  findTestProjects,
  loadProject,
  PRESET_IMPORT_EXEMPT,
} from "./coverage-guard.js";

const good = {
  dir: "services/demo",
  command: "vitest run --coverage",
  scriptCommand: "vitest run --coverage",
  config: 'import { coveragePreset } from "@platform/test-config";',
};

describe("AICHAT-118: every project with a test target enforces coverage", () => {
  const projects = findTestProjects();

  it("finds the Node test projects of the workspace", () => {
    expect(projects).toEqual(
      expect.arrayContaining(["apps/shell", "packages/ui", "services/auth-service", "e2e", "testing/k6"]),
    );
  });

  it.each(projects)("%s runs --coverage and imports @platform/test-config", (dir) => {
    expect(checkProject(loadProject(dir))).toEqual([]);
  });

  it("only exempts projects with a written reason", () => {
    for (const [dir, reason] of [
      ...Object.entries(COVERAGE_EXEMPT),
      ...Object.entries(PRESET_IMPORT_EXEMPT),
    ]) {
      expect(projects, `${dir} is exempt but has no test target`).toContain(dir);
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});

describe("AICHAT-118: checkProject reports the cases that skip coverage", () => {
  it("accepts a correct project", () => {
    expect(checkProject(good)).toEqual([]);
  });

  it("fails when the Nx test target has no --coverage", () => {
    const problems = checkProject({ ...good, command: "vitest run" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Nx test target .* does not run with --coverage/);
  });

  it("fails when the package.json test script has no --coverage", () => {
    const problems = checkProject({ ...good, scriptCommand: "vitest run" });
    expect(problems[0]).toMatch(/package\.json test script/);
  });

  it("ignores a missing package.json script", () => {
    expect(checkProject({ ...good, scriptCommand: undefined })).toEqual([]);
  });

  it("fails when the config does not import the shared preset", () => {
    const problems = checkProject({ ...good, config: "export default {};" });
    expect(problems[0]).toMatch(/does not import @platform\/test-config/);
  });

  it("fails when there is no Vitest config", () => {
    expect(checkProject({ ...good, config: undefined })[0]).toMatch(/no vitest.config.ts/);
  });

  it("skips exempt projects", () => {
    const k6 = { dir: "testing/k6", command: "vitest run", config: "export default {};" };
    expect(checkProject(k6)).toEqual([]);
  });

  it("allows the preset package to import itself relatively", () => {
    const self = { ...good, dir: "packages/test-config", config: 'import "./vitest.preset.js";' };
    expect(checkProject(self)).toEqual([]);
  });
});
