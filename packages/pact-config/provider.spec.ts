import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pactFilesFor, splitKnownFailures, type KnownFailure } from "./provider.js";

function pactsDir(files: Record<string, { consumer: string; descriptions: string[] }>) {
  const dir = mkdtempSync(join(tmpdir(), "pacts-"));
  for (const [name, { consumer, descriptions }] of Object.entries(files)) {
    const pact = { consumer: { name: consumer }, provider: { name: "p" }, interactions: descriptions.map((d) => ({ description: d })) };
    writeFileSync(join(dir, name), JSON.stringify(pact));
  }
  return dir;
}

const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as { interactions: { description: string }[] };

describe("pactFilesFor (AICHAT-11)", () => {
  it("returns every <consumer>-<provider>.json, sorted", () => {
    const dir = pactsDir({
      "shell-auth-service.json": { consumer: "shell", descriptions: ["a"] },
      "mfe-auth-auth-service.json": { consumer: "mfe-auth", descriptions: ["b"] },
      "mfe-chat-conversation-service.json": { consumer: "mfe-chat", descriptions: ["c"] },
    });

    expect(pactFilesFor("auth-service", dir)).toEqual([join(dir, "mfe-auth-auth-service.json"), join(dir, "shell-auth-service.json")]);
  });

  it("fails when there is no pact, so an empty verification cannot pass", () => {
    const dir = pactsDir({});
    expect(() => pactFilesFor("auth-service", dir)).toThrow(/no pact files for auth-service/);
    expect(() => pactFilesFor("auth-service", join(dir, "missing"))).toThrow(/run the consumer tests first/);
  });
});

describe("splitKnownFailures (AICHAT-11)", () => {
  const upload: KnownFailure = { consumer: "mfe-chat", description: "an upload", issue: "AICHAT-255" };

  it("verifies everything else and isolates each known failure in its own file", () => {
    const dir = pactsDir({
      "mfe-chat-p.json": { consumer: "mfe-chat", descriptions: ["a list", "an upload"] },
      "mfe-settings-p.json": { consumer: "mfe-settings", descriptions: ["a test"] },
    });

    const split = splitKnownFailures(
      [join(dir, "mfe-chat-p.json"), join(dir, "mfe-settings-p.json")],
      [upload, { consumer: "mfe-settings", description: "a test", issue: "AICHAT-256" }],
      join(dir, "out"),
    );

    expect(split.verify.map((f) => read(f).interactions.map((i) => i.description))).toEqual([["a list"]]);
    expect(split.expectedToFail.map((e) => [e.failure.issue, read(e.file).interactions.map((i) => i.description)])).toEqual([
      ["AICHAT-255", ["an upload"]],
      ["AICHAT-256", ["a test"]],
    ]);
  });

  it("only matches the listed consumer", () => {
    const dir = pactsDir({ "mfe-other-p.json": { consumer: "mfe-other", descriptions: ["an upload"] } });

    expect(() => splitKnownFailures([join(dir, "mfe-other-p.json")], [upload], join(dir, "out"))).toThrow(
      /match no interaction.*AICHAT-255 mfe-chat: "an upload"/,
    );
  });

  it("returns no file to verify when every interaction is a known failure", () => {
    const dir = pactsDir({ "mfe-chat-p.json": { consumer: "mfe-chat", descriptions: ["an upload"] } });

    const split = splitKnownFailures([join(dir, "mfe-chat-p.json")], [upload], join(dir, "out"));

    expect(split.verify).toEqual([]);
    expect(split.expectedToFail).toHaveLength(1);
  });
});
