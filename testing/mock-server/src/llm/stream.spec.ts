import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { streamScenarioText, UnknownScenarioError } from "./stream.js";

const ctx = (env: NodeJS.ProcessEnv = {}) => ({
  config: loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "8", ...env }),
});

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const token of iterable) out.push(token);
  return out;
}

describe("streamScenarioText", () => {
  it("yields TOKENS tokens of text", async () => {
    const tokens = await collect(streamScenarioText("ok", ctx()));
    expect(tokens).toHaveLength(8);
    expect(tokens.join("").endsWith(".")).toBe(true);
  });

  it("gives the same text for the same SEED and a different text for another", async () => {
    const a = await collect(streamScenarioText("ok", ctx({ SEED: "7" })));
    const b = await collect(streamScenarioText("ok", ctx({ SEED: "7" })));
    const c = await collect(streamScenarioText("ok", ctx({ SEED: "8" })));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await collect(streamScenarioText("ok", ctx(), { signal: controller.signal }))).toEqual([]);
  });

  it("rejects a name that is not a text scenario", async () => {
    await expect(collect(streamScenarioText("nope", ctx()))).rejects.toBeInstanceOf(UnknownScenarioError);
  });
});
