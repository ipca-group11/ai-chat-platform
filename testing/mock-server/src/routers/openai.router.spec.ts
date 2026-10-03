import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

const app = () => createApp(loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "5" })).app;
const body = { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] };

const stream = async (scenario?: string, extra: object = {}) => {
  const req = request(app())
    .post("/openai/v1/chat/completions")
    .buffer(true)
    .parse((res, done) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => done(null, text));
    })
    .send({ ...body, stream: true, ...extra });
  if (scenario) req.set("X-Mock-Scenario", scenario);
  const res = await req;
  const lines = (res.body as string).split("\n\n").filter(Boolean);
  return { res, lines };
};

const chunks = (lines: string[]) =>
  lines.filter((l) => l !== "data: [DONE]").map((l) => JSON.parse(l.replace("data: ", "")));

describe("POST /openai/v1/chat/completions (stream)", () => {
  it("streams chunks, a finish_reason stop and [DONE]", async () => {
    const { res, lines } = await stream();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(lines.at(-1)).toBe("data: [DONE]");
    const all = chunks(lines);
    expect(all).toHaveLength(6);
    expect(all[0].choices[0].delta).toMatchObject({ role: "assistant" });
    expect(all.every((c) => c.object === "chat.completion.chunk" && c.model === "gpt-4o")).toBe(true);
    expect(all.slice(0, -1).every((c) => c.choices[0].finish_reason === null)).toBe(true);
    expect(all.at(-1).choices[0]).toEqual({ index: 0, delta: {}, finish_reason: "stop" });
    const text = all.map((c) => c.choices[0].delta.content ?? "").join("");
    expect(text.endsWith(".")).toBe(true);
  });

  it("ends with finish_reason length for max-tokens", async () => {
    const { lines } = await stream("max-tokens");
    expect(chunks(lines).at(-1).choices[0].finish_reason).toBe("length");
    expect(lines.at(-1)).toBe("data: [DONE]");
  });

  it("adds a usage chunk when stream_options.include_usage is set", async () => {
    const { lines } = await stream(undefined, { stream_options: { include_usage: true } });
    const last = chunks(lines).at(-1);
    expect(last.choices).toEqual([]);
    expect(last.usage).toEqual({ prompt_tokens: 25, completion_tokens: 5, total_tokens: 30 });
  });

  it("does not offer the Anthropic-only scenarios", async () => {
    const res = await request(app()).post("/openai/v1/chat/completions").set("X-Mock-Scenario", "thinking").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("unknown_scenario");
  });
});

describe("POST /openai/v1/chat/completions (not streaming)", () => {
  it("returns a chat.completion object", async () => {
    const res = await request(app()).post("/openai/v1/chat/completions").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      object: "chat.completion",
      model: "gpt-4o",
      choices: [{ index: 0, message: { role: "assistant" }, finish_reason: "stop" }],
      usage: { completion_tokens: 5 },
    });
    expect(res.body.id).toMatch(/^chatcmpl-/);
  });

  it("returns length for max-tokens", async () => {
    const res = await request(app()).post("/openai/v1/chat/completions").set("X-Mock-Scenario", "max-tokens").send(body);
    expect(res.body.choices[0].finish_reason).toBe("length");
  });

  it("rejects a body without messages and uses the default model", async () => {
    const bad = await request(app()).post("/openai/v1/chat/completions").send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.param).toBe("messages");
    const ok = await request(app()).post("/openai/v1/chat/completions").send({ messages: [] });
    expect(ok.body.model).toBe("gpt-4o");
  });
});
