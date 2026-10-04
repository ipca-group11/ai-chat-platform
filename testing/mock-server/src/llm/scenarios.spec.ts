import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

const make = (env: NodeJS.ProcessEnv = {}) =>
  createApp(loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "6", ...env })).app;

const messages = [{ role: "user", content: "hi" }];

describe("scenario selection", () => {
  it("selects a scenario with the model name suffix and echoes the model without it", async () => {
    const res = await request(make())
      .post("/anthropic/v1/messages")
      .send({ model: "claude-sonnet-4-5@thinking", messages });
    expect(res.body.model).toBe("claude-sonnet-4-5");
    expect(res.body.content.map((b: { type: string }) => b.type)).toEqual(["thinking", "text"]);
  });

  it("selects a scenario with the X-Mock-Scenario header", async () => {
    const res = await request(make())
      .post("/openai/v1/chat/completions")
      .set("X-Mock-Scenario", "max-tokens")
      .send({ model: "gpt-4o", messages });
    expect(res.body.choices[0].finish_reason).toBe("length");
  });

  it("lets the header win over the suffix", async () => {
    const res = await request(make())
      .post("/anthropic/v1/messages")
      .set("X-Mock-Scenario", "max-tokens")
      .send({ model: "claude-sonnet-4-5@thinking", messages });
    expect(res.body.stop_reason).toBe("max_tokens");
    expect(res.body.content.map((b: { type: string }) => b.type)).toEqual(["text"]);
  });

  it("falls back to ok for an empty suffix", async () => {
    const res = await request(make()).post("/openai/v1/chat/completions").send({ model: "gpt-4o@", messages });
    expect(res.body.model).toBe("gpt-4o");
    expect(res.body.choices[0].finish_reason).toBe("stop");
  });

  it("answers an unknown scenario with 400 and the names that exist", async () => {
    const res = await request(make()).post("/anthropic/v1/messages").send({ model: "claude@nope", messages });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("nope");
    expect(res.body.error.message).toContain("pause-turn");
  });

  it("does not take names of Object.prototype for scenarios", async () => {
    const res = await request(make()).post("/anthropic/v1/messages").send({ model: "claude@constructor", messages });
    expect(res.status).toBe(400);
  });
});

describe("/__admin/scenarios", () => {
  it("lists the scenarios of both LLM mocks", async () => {
    const res = await request(make()).get("/__admin/scenarios");
    const names = (mock: string) =>
      res.body.scenarios.filter((s: { mock: string }) => s.mock === mock).map((s: { name: string }) => s.name);
    expect(names("anthropic")).toEqual([
      "drop", "error-401", "error-429", "error-500", "error-529",
      "inject-obey", "inject-resist", "long", "max-tokens", "ok", "pause-turn", "replay:<fixture>", "slow", "thinking", "web-fetch",
    ]);
    expect(names("openai")).toEqual([
      "drop", "error-401", "error-429", "error-500", "error-503", "long", "max-tokens", "ok", "replay:<fixture>", "slow",
    ]);
    expect(res.body.scenarios[0]).toHaveProperty("description");
  });
});

describe("SEED", () => {
  const answer = async (env: NodeJS.ProcessEnv) => {
    const res = await request(make(env)).post("/openai/v1/chat/completions").send({ model: "gpt-4o", messages });
    return res.body.choices[0].message.content as string;
  };

  it("gives the same answer for the same SEED, even across requests", async () => {
    const app = make({ SEED: "42" });
    const first = await request(app).post("/openai/v1/chat/completions").send({ messages });
    const second = await request(app).post("/openai/v1/chat/completions").send({ messages });
    expect(first.body.choices[0].message.content).toBe(second.body.choices[0].message.content);
    expect(await answer({ SEED: "42" })).toBe(first.body.choices[0].message.content);
  });

  it("gives another answer for another SEED", async () => {
    expect(await answer({ SEED: "42" })).not.toBe(await answer({ SEED: "43" }));
  });
});
