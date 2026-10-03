import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

const app = () => createApp(loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "6" })).app;

interface Frame {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

function parse(text: string): Frame[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((raw) => {
      const lines = raw.split("\n");
      return {
        event: lines[0]!.replace("event: ", ""),
        data: JSON.parse(lines[1]!.replace("data: ", "")),
      };
    });
}

const stream = async (scenario?: string, body: object = {}) => {
  const req = request(app())
    .post("/anthropic/v1/messages")
    .buffer(true)
    .parse((res, done) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => done(null, text));
    })
    .send({ model: "claude-sonnet-4-5", max_tokens: 100, stream: true, messages: [{ role: "user", content: "hi" }], ...body });
  if (scenario) req.set("X-Mock-Scenario", scenario);
  const res = await req;
  return { res, frames: parse(res.body as string) };
};

describe("POST /anthropic/v1/messages (stream)", () => {
  it("sends the full event sequence of a text answer", async () => {
    const { res, frames } = await stream();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    const kinds = frames.map((f) => f.event);
    expect(kinds[0]).toBe("message_start");
    expect(kinds[1]).toBe("content_block_start");
    expect(kinds.filter((k) => k === "content_block_delta")).toHaveLength(6);
    expect(kinds.slice(-3)).toEqual(["content_block_stop", "message_delta", "message_stop"]);
    expect(frames.at(-2)!.data.delta.stop_reason).toBe("end_turn");
    const text = frames.filter((f) => f.event === "content_block_delta").map((f) => f.data.delta.text).join("");
    expect(text.endsWith(".")).toBe(true);
  });

  it("sends a thinking block with a signature before the text", async () => {
    const { frames } = await stream("thinking");
    const starts = frames.filter((f) => f.event === "content_block_start").map((f) => f.data.content_block.type);
    expect(starts).toEqual(["thinking", "text"]);
    const deltas = frames.filter((f) => f.event === "content_block_delta").map((f) => f.data.delta.type);
    expect(deltas).toContain("thinking_delta");
    expect(deltas).toContain("signature_delta");
  });

  it("sends a web_fetch tool call and its result", async () => {
    const { frames } = await stream("web-fetch");
    const starts = frames.filter((f) => f.event === "content_block_start").map((f) => f.data.content_block.type);
    expect(starts).toEqual(["text", "server_tool_use", "web_fetch_tool_result", "text"]);
    const tool = frames.find((f) => f.data.delta?.type === "input_json_delta")!;
    expect(JSON.parse(tool.data.delta.partial_json)).toEqual({ url: "https://example.com" });
    expect(frames.at(-2)!.data.delta.stop_reason).toBe("end_turn");
  });

  it("stops with max_tokens", async () => {
    const { frames } = await stream("max-tokens");
    expect(frames.at(-2)!.data.delta.stop_reason).toBe("max_tokens");
  });

  it("pauses the turn, then ends it when the request resumes the assistant turn", async () => {
    const paused = await stream("pause-turn");
    expect(paused.frames.at(-2)!.data.delta.stop_reason).toBe("pause_turn");
    const resumed = await stream("pause-turn", {
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: [{ type: "text", text: "I will fetch the page." }] },
      ],
    });
    expect(resumed.frames.at(-2)!.data.delta.stop_reason).toBe("end_turn");
    expect(resumed.frames.some((f) => f.data.content_block?.type === "server_tool_use")).toBe(false);
  });

  it("makes a long answer ten times longer", async () => {
    const { frames } = await stream("long");
    expect(frames.filter((f) => f.event === "content_block_delta")).toHaveLength(60);
  });
});

describe("POST /anthropic/v1/messages (not streaming)", () => {
  const post = (scenario?: string, body: object = {}) => {
    const req = request(app())
      .post("/anthropic/v1/messages")
      .send({ model: "claude-sonnet-4-5", max_tokens: 100, messages: [{ role: "user", content: "hi" }], ...body });
    return scenario ? req.set("X-Mock-Scenario", scenario) : req;
  };

  it("returns the whole message as JSON", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
      usage: { output_tokens: 6 },
    });
    expect(res.body.id).toMatch(/^msg_/);
    expect(res.body.content).toHaveLength(1);
    expect(res.body.content[0].type).toBe("text");
  });

  it("returns thinking and web fetch blocks", async () => {
    const thinking = await post("thinking");
    expect(thinking.body.content.map((b: { type: string }) => b.type)).toEqual(["thinking", "text"]);
    const fetched = await post("web-fetch");
    expect(fetched.body.content.map((b: { type: string }) => b.type)).toEqual([
      "text",
      "server_tool_use",
      "web_fetch_tool_result",
      "text",
    ]);
  });

  it("rejects a body without messages and an unknown scenario", async () => {
    const noMessages = await request(app()).post("/anthropic/v1/messages").send({ model: "x" });
    expect(noMessages.status).toBe(400);
    expect(noMessages.body.error.type).toBe("invalid_request_error");
    const unknown = await post("nope");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.message).toContain("nope");
  });

  it("uses the default model when none is sent", async () => {
    const res = await request(app()).post("/anthropic/v1/messages").send({ messages: [] });
    expect(res.body.model).toBe("claude-sonnet-4-5");
  });
});
