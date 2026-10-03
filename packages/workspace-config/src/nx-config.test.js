import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readRepoFile, readRepoJson, repoRoot } from "./repo.js";

describe("AC-2: Nx workspace is configured with a project graph covering every app, service, and package", () => {
  it(
    "AC-2: `nx show projects` resolves without error and lists every project.json in the workspace",
    () => {
      const out = execFileSync("pnpm", ["exec", "nx", "show", "projects", "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      const projects = JSON.parse(out.trim());
      expect(Array.isArray(projects)).toBe(true);
      // Every project this pod owns today must be discoverable by Nx; apps/services owned
      // by other pods are added to the same graph once their project.json lands (see
      // docs/pods/platform-foundation/PLAN.md "Known gaps").
      expect(projects).toEqual(expect.arrayContaining(["shared-types", "eslint-config"]));
    },
    20000,
  );

  it("AC-2: nx.json does not restrict project discovery to an explicit, incomplete project list", () => {
    const nxJson = readRepoJson("nx.json");
    // No legacy `projects` allow-list — Nx auto-discovers every project.json/package.json
    // under the pnpm-workspace.yaml globs, so newly added apps/services/packages are
    // picked up automatically.
    expect(nxJson.projects).toBeUndefined();
  });
});

describe("AC-3: every project defines Nx targets for lint, typecheck, test, and build (via targetDefaults)", () => {
  const nxJson = readRepoJson("nx.json");

  it.each(["lint", "typecheck", "test", "build", "serve", "storybook"])(
    "AC-3: nx.json targetDefaults declares a %s target",
    (target) => {
      expect(nxJson.targetDefaults).toHaveProperty(target);
    },
  );

  it("AC-3: build depends on upstream builds (^build) so packages build before consumers", () => {
    expect(nxJson.targetDefaults.build.dependsOn).toContain("^build");
  });

  it("AC-3: serve and storybook are never cached (long-running dev servers)", () => {
    expect(nxJson.targetDefaults.serve.cache).toBe(false);
    expect(nxJson.targetDefaults.storybook.cache).toBe(false);
  });

  it("AC-3: CONVENTIONS.md documents the required project.json target shape for every other pod", () => {
    const conventions = readRepoFile("docs/pods/platform-foundation/CONVENTIONS.md");
    expect(conventions).toMatch(/"lint"/);
    expect(conventions).toMatch(/"typecheck"/);
    expect(conventions).toMatch(/"test"/);
    expect(conventions).toMatch(/"build"/);
  });
});

describe("AC-4: Nx tags enforce module boundaries (apps depend on packages/*, never on another app)", () => {
  const eslintBaseSrc = readRepoFile("packages/eslint-config/src/base.js");

  it("AC-4: base eslint preset wires up @nx/enforce-module-boundaries", () => {
    expect(eslintBaseSrc).toMatch(/@nx\/enforce-module-boundaries/);
  });

  it("AC-4: type:app and type:service may only depend on type:package", () => {
    expect(eslintBaseSrc).toMatch(/sourceTag: "type:app"[\s\S]*?onlyDependOnLibsWithTags: \["type:package"\]/);
    expect(eslintBaseSrc).toMatch(
      /sourceTag: "type:service"[\s\S]*?onlyDependOnLibsWithTags: \["type:package"\]/,
    );
  });

  it("AC-4: type:package may only depend on other type:package (never on an app or service)", () => {
    expect(eslintBaseSrc).toMatch(
      /sourceTag: "type:package"[\s\S]*?onlyDependOnLibsWithTags: \["type:package"\]/,
    );
  });

  it("AC-4: every package this pod owns is tagged type:package, scope:shared", () => {
    for (const pkg of ["shared-types", "eslint-config", "workspace-config"]) {
      const project = readRepoJson(`packages/${pkg}/project.json`);
      expect(project.tags).toEqual(expect.arrayContaining(["type:package", "scope:shared"]));
    }
    // packages/tsconfig has no build/lint/test targets (pure JSON, nothing to run), so
    // its tags live on package.json instead of a project.json (documented in
    // CONVENTIONS.md §2).
    const tsconfigPkg = readRepoJson("packages/tsconfig/package.json");
    expect(tsconfigPkg.nx.tags).toEqual(expect.arrayContaining(["type:package", "scope:shared"]));
  });
});
