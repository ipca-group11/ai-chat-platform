import { describe, expect, it, vi } from "vitest";
import type { Reply } from "./client.ts";
import AppApiProvider from "./provider.ts";
import type { RunSettings } from "./scenario.ts";

const reply = (over: Partial<Reply> = {}): Reply => ({ text: "answer", fetchedUrls: ["https://a.test/"], refusedUrls: [], ...over });

function make(env: Record<string, string>, result: Reply = reply()) {
  const run = vi.fn(async (_attack: unknown, _settings: RunSettings) => result);
  return { provider: new AppApiProvider({ testEnv: env, run: run as never }), run };
}

describe("AppApiProvider", () => {
  it("reads process.env when promptfoo builds it with its own options", () => {
    const provider = new AppApiProvider({ id: "file://src/provider.ts", config: {}, env: {} } as never);
    expect(provider.id()).toBe("app-api");
  });

  it("has the id app-api", () => {
    expect(make({}).provider.id()).toBe("app-api");
  });

  it("plays the attack named in vars and returns the answer with the fetched URLs", async () => {
    const { provider, run } = make({ REDTEAM_APP_URL: "http://localhost:9999/", REDTEAM_MODEL: "claude-haiku-4-5@inject-resist", ANTHROPIC_API_KEY: "k", PAGES_BASE_URL: "http://p" });
    const response = await provider.callApi("A4", { vars: { attack: "A4" } });
    expect(response).toMatchObject({ output: "answer", metadata: { attack: "A4", surface: "web", model: "claude-haiku-4-5", fetchedUrls: ["https://a.test/"] } });
    expect(run.mock.calls[0]?.[1]).toMatchObject({ baseUrl: "http://localhost:9999", apiKey: "k", pagesBaseUrl: "http://p", model: "claude-haiku-4-5@inject-resist" });
  });

  it("uses safe defaults: the local stack, the Haiku model and a placeholder key for the mock", async () => {
    const { provider, run } = make({});
    await provider.callApi("A7a", { vars: { attack: "A7a" } });
    expect(run.mock.calls[0]?.[1]).toMatchObject({ baseUrl: "http://localhost:8000", model: "claude-haiku-4-5", apiKey: "mock-key-not-a-secret" });
  });

  it("reports a provider error of the app as an error, not as an answer", async () => {
    const { provider } = make({ REDTEAM_MODEL: "claude-haiku-4-5@ok" }, reply({ error: "invalid key" }));
    expect(await provider.callApi("A7a", { vars: { attack: "A7a" } })).toEqual({ error: "the app reported a provider error: invalid key" });
  });

  it("reports an unknown attack and a failing run as errors", async () => {
    const { provider } = make({});
    expect(await provider.callApi("x", { vars: { attack: "A99" } })).toMatchObject({ error: expect.stringContaining("unknown attack") });
    expect(await provider.callApi("x")).toMatchObject({ error: expect.stringContaining("unknown attack") });
    const failing = new AppApiProvider({
      testEnv: { REDTEAM_MODEL: "claude-haiku-4-5@ok" },
      run: (async () => {
        throw new Error("boom");
      }) as never,
    });
    expect(await failing.callApi("A7a", { vars: { attack: "A7a" } })).toEqual({ error: "boom" });
  });

  it("plays the text file and PDF attacks (AICHAT-244: attachments reach the model)", async () => {
    const { provider, run } = make({ REDTEAM_MODEL: "claude-haiku-4-5@ok" });
    expect(await provider.callApi("A2b", { vars: { attack: "A2b" } })).toMatchObject({ output: "answer", metadata: { attack: "A2b", surface: "file" } });
    expect(run).toHaveBeenCalledOnce();
  });

  it("charges a live model to the cap and stops when the cap would be passed, the mock is free", async () => {
    const tiny = make({ REDTEAM_BUDGET_USD: "0.001" });
    expect(await tiny.provider.callApi("A4", { vars: { attack: "A4" } })).toMatchObject({ error: expect.stringContaining("budget cap reached") });
    expect(tiny.run).not.toHaveBeenCalled();
    const free = make({ REDTEAM_BUDGET_USD: "0.001", REDTEAM_MODEL: "claude-haiku-4-5@inject-obey" });
    expect(await free.provider.callApi("A4", { vars: { attack: "A4" } })).toMatchObject({ output: "answer" });
  });
});
