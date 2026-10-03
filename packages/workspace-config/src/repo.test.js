import { describe, expect, it } from "vitest";
import { readRepoFile, readRepoJson, repoRoot } from "./repo.js";

describe("repo helpers", () => {
  it("resolves repoRoot to the directory containing pnpm-workspace.yaml", () => {
    expect(() => readRepoFile("pnpm-workspace.yaml")).not.toThrow();
    expect(repoRoot.length).toBeGreaterThan(0);
  });

  it("readRepoFile throws a clear error for a missing file", () => {
    expect(() => readRepoFile("does-not-exist.txt")).toThrow(/Expected repo file/);
  });

  it("readRepoJson parses JSON content relative to the repo root", () => {
    const pkg = readRepoJson("package.json");
    expect(pkg.name).toBe("llm-chat-workspace");
  });
});
