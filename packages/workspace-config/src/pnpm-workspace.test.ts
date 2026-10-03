import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.ts";

describe("AC-1: pnpm-workspace.yaml defines apps/, services/, and packages/ as workspace packages", () => {
  const workspace = parse(readRepoFile("pnpm-workspace.yaml"));

  it("AC-1: declares a `packages` list", () => {
    expect(Array.isArray(workspace.packages)).toBe(true);
  });

  it("AC-1: includes apps/*, services/*, and packages/* globs", () => {
    expect(workspace.packages).toEqual(expect.arrayContaining(["apps/*", "services/*", "packages/*"]));
  });
});
