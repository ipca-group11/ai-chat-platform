import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDataset, createFactories } from "./index.js";

describe("package entry", () => {
  it("exposes the factories and datasets", () => {
    expect(createFactories().user().id).toBe("user_00001");
    expect(buildDataset("empty").chats).toEqual([]);
  });

  it("is the entry of @platform/mock-server", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.name).toBe("@platform/mock-server");
    expect(pkg.exports["."]).toBe("./src/data/index.ts");
  });
});
