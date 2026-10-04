import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on `.github/workflows/visual.yml` (AICHAT-92): the screenshot comparison must
 * run on the agreed triggers inside the pinned Playwright image, fail on a diff and keep the diff
 * images as an artifact. Marking the job as a required check is a branch-protection setting
 * (unavailable on this private free-plan repository), so it is a team rule written in the
 * workflow header; this suite only checks the workflow is wired to produce that check.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const workflow = read(".github/workflows/visual.yml");
const e2ePackage = JSON.parse(read("e2e/package.json")) as { scripts: Record<string, string>; devDependencies: Record<string, string> };
const config = read("e2e/playwright.config.ts");
const projectJson = read("e2e/project.json");

describe("visual CI workflow (AICHAT-92)", () => {
  it("runs on pull requests to the integration branch and main, only for files that change a screenshot, and on demand", () => {
    expect(workflow).toMatch(/pull_request:\s*\n\s+branches: \[integration\/testing-epics, main\]/);
    for (const path of ["apps/**", "packages/ui/**", "e2e/src/visual/**"]) expect(workflow).toContain(`- "${path}"`);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/^\s+push:/m);
  });

  it("builds the shell and the three remotes before the comparison", () => {
    expect(workflow).toMatch(/nx run-many -t build -p shell mfe-auth mfe-chat mfe-settings/);
    expect(workflow.indexOf("nx run-many")).toBeLessThan(workflow.indexOf("run visual"));
  });

  it("needs no compose stack and no secrets", () => {
    expect(workflow).not.toMatch(/mock:up|docker compose|secrets\./);
  });

  it("runs the same command as a developer, so the job fails on a diff (exit code of Playwright)", () => {
    expect(workflow).toContain("run: pnpm --filter e2e run visual");
    expect(workflow).not.toMatch(/continue-on-error|--update-snapshots/);
    expect(e2ePackage.scripts["visual"]).toContain("--project=visual");
    expect(e2ePackage.scripts["visual"]).not.toContain("--update-snapshots");
    expect(e2ePackage.scripts["visual:update"]).toContain("--update-snapshots");
  });

  it("uploads the diff images from test-results when the job fails", () => {
    expect(workflow).toMatch(/if: failure\(\)\s*\n\s+uses: actions\/upload-artifact@v4/);
    expect(workflow).toContain("path: e2e/test-results/");
    expect(workflow).toContain("name: visual-diff");
  });

  it("documents the required-check team rule", () => {
    expect(workflow).toContain('"visual / screenshots"');
  });
});

describe("Playwright Docker image for the screenshots (AICHAT-74)", () => {
  const version = e2ePackage.devDependencies["@playwright/test"] ?? "";

  it("pins @playwright/test to an exact version, so the image tag can match it", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("uses the image of that exact version, for both the comparison and the update command", () => {
    for (const script of ["visual", "visual:update"]) {
      expect(e2ePackage.scripts[script]).toContain(`mcr.microsoft.com/playwright:v${version}-noble`);
    }
  });
});

describe("visual Playwright project (AICHAT-56)", () => {
  it("has its own folder, viewport, thresholds and snapshot path template", () => {
    expect(config).toMatch(/name: "visual",\s*\n\s+testDir: "\.\/src\/visual"/);
    expect(config).toContain('testIgnore: "**/lib/**"');
    expect(config).toContain('snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}"');
    expect(config).toContain("viewport: { width: 1280, height: 800 }");
    expect(config).toMatch(/maxDiffPixels: 50/);
    expect(config).toMatch(/threshold: 0\.2/);
    expect(config).toMatch(/animations: "disabled"/);
    expect(config).toMatch(/caret: "hide"/);
  });

  it("keeps the e2e suite and the visual suite apart", () => {
    expect(config).toContain('testDir: "./src/tests"');
    expect(projectJson).toContain("playwright test --project=chromium");
    expect(e2ePackage.scripts["e2e"]).toContain("--project=chromium");
  });
});
