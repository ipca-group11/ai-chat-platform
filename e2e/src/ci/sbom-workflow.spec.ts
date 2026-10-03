import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the SBOM steps of `deploy.yml` and `ci.yml` (AICHAT-30). The workflows
 * cannot run against Azure from here, so these tests pin what the epic added: the BuildKit
 * attestations, one CycloneDX artifact per image, the two third-party images, a Grype step
 * that reports without failing, and the source SBOM on pull requests.
 */

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../.github/workflows/${name}`, import.meta.url)), "utf-8");

const deploy = read("deploy.yml");
const ci = read("ci.yml");

const builtImages = [
  "auth-service",
  "conversation-service",
  "mfe-auth",
  "mfe-chat",
  "mfe-settings",
  "shell",
  "prometheus",
  "grafana",
  "loki",
  "alloy",
];

/** The text of one top-level job, up to the next job or the end of the file. */
function job(workflow: string, name: string): string {
  const start = workflow.search(new RegExp(`^  ${name}:`, "m"));
  expect(start, `job ${name} exists`).toBeGreaterThanOrEqual(0);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^ {2}[a-z][\w-]*:/m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe("deploy.yml image attestations (AICHAT-53)", () => {
  const build = job(deploy, "build");

  it("builds all ten images, each of them in the matrix", () => {
    for (const name of builtImages) {
      expect(build).toContain(`{ name: ${name},`);
    }
    expect(build.match(/\{ name: [\w-]+, dockerfile:/g)).toHaveLength(10);
  });

  it("attaches the SBOM and full provenance on the pushed image", () => {
    expect(build).toMatch(/^\s+sbom: true$/m);
    expect(build).toMatch(/^\s+provenance: mode=max$/m);
    expect(build).toMatch(/^\s+push: true$/m);
  });

  it("pins build-push-action to a major version", () => {
    expect(build).toMatch(/uses: docker\/build-push-action@v\d+/);
  });
});

describe("deploy.yml CycloneDX artifacts (AICHAT-70)", () => {
  const build = job(deploy, "build");

  it("runs Syft through sbom-action on the image just pushed, pinned by version", () => {
    expect(build).toMatch(/uses: anchore\/sbom-action@v\d+/);
    expect(build).toContain("image: ${{ env.IMAGE_PREFIX }}/${{ matrix.name }}:${{ env.SHA }}");
    expect(build).toContain("format: cyclonedx-json");
  });

  it("names the artifact sbom-<name>.cdx.json for every matrix entry and keeps it 90 days", () => {
    expect(build).toContain("artifact-name: sbom-${{ matrix.name }}.cdx.json");
    expect(build).toContain("output-file: sbom-${{ matrix.name }}.cdx.json");
    expect(build).toContain("upload-artifact-retention: 90");
  });

  it("runs the SBOM step after the push, so the image exists in the registry", () => {
    expect(build.indexOf("build-push-action")).toBeLessThan(build.indexOf("anchore/sbom-action"));
  });

  it("makes SBOMs of the two third-party images, with the same naming", () => {
    const third = job(deploy, "sbom-third-party");
    expect(third).toContain('image: "postgres:16-alpine"');
    expect(third).toContain('image: "caddy:2-alpine"');
    expect(third).toMatch(/uses: anchore\/sbom-action@v\d+/);
    expect(third).toContain("artifact-name: sbom-${{ matrix.name }}.cdx.json");
    expect(third).toContain("format: cyclonedx-json");
  });

  it("does not deploy before all SBOMs exist", () => {
    expect(job(deploy, "deploy")).toMatch(/needs: \[build, sbom-third-party\]/);
  });
});

describe("deploy.yml vulnerability scan of the SBOMs (AICHAT-88)", () => {
  const scan = job(deploy, "scan-sbom");

  it("downloads every sbom-*.cdx.json artifact", () => {
    expect(scan).toMatch(/uses: actions\/download-artifact@v\d+/);
    expect(scan).toContain("pattern: sbom-*.cdx.json");
    expect(scan).toContain("merge-multiple: true");
    expect(scan).toMatch(/needs: \[build, sbom-third-party\]/);
  });

  it("runs Grype on each SBOM, pinned by version", () => {
    expect(scan).toMatch(/uses: anchore\/scan-action\/download-grype@v\d+/);
    expect(scan).toContain('"sbom:$f"');
  });

  it("only reports: the severity threshold belongs to AICHAT-7", () => {
    expect(scan).toContain("|| true");
    expect(scan).not.toContain("--fail-on");
    expect(scan).toContain("GITHUB_STEP_SUMMARY");
  });

  it("is not a dependency of the deploy job", () => {
    expect(job(deploy, "deploy")).not.toContain("scan-sbom");
  });
});

describe("ci.yml source SBOM (AICHAT-108)", () => {
  const source = job(ci, "source-sbom");

  it("scans the checked-out workspace with Syft and uploads the artifact", () => {
    expect(source).toMatch(/uses: actions\/checkout@v\d+/);
    expect(source).toMatch(/uses: anchore\/sbom-action@v\d+/);
    expect(source).toMatch(/^\s+path: \.$/m);
    expect(source).toContain("format: cyclonedx-json");
    expect(source).toContain("artifact-name: sbom-source.cdx.json");
  });

  it("runs on pull requests (the workflow trigger) and is independent of the Nx job", () => {
    expect(ci).toMatch(/^\s+pull_request:/m);
    expect(source).not.toContain("needs:");
  });
});

describe("SBOM hand-off note (AICHAT-88)", () => {
  const note = readFileSync(
    fileURLToPath(new URL("../../../docs/AICHAT-30/SBOM-INTERFACE.md", import.meta.url)),
    "utf-8",
  );

  it("names every artifact the workflows produce", () => {
    for (const name of [...builtImages, "postgres", "caddy", "source"]) {
      expect(note).toContain(`sbom-${name}.cdx.json`);
    }
  });
});
