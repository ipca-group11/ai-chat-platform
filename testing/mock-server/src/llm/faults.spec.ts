import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { RETRY_AFTER_SECONDS } from "./errors.js";
import { SLOW_FIRST_TOKEN_MS } from "./scenarios.js";
import { streamScenarioText } from "./stream.js";

const config = (env: NodeJS.ProcessEnv = {}) =>
  loadConfig({ TTFT_MS: "0", TOKEN_INTERVAL_MS: "0", TOKENS: "10", ...env });
const messages = [{ role: "user", content: "hi" }];

describe("Anthropic error scenarios", () => {
  const post = (scenario: string) =>
    request(createApp(config()).app).post("/anthropic/v1/messages").set("X-Mock-Scenario", scenario).send({ messages });

  it.each([
    [401, "authentication_error", "invalid x-api-key"],
    [429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"],
    [500, "api_error", "Internal server error"],
    [529, "overloaded_error", "Overloaded"],
  ])("error-%i answers with the Anthropic error body", async (status, type, message) => {
    const res = await post(`error-${status}`);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ type: "error", error: { type, message }, request_id: expect.stringMatching(/^req_/) });
    expect(res.headers["request-id"]).toBe(res.body.request_id);
  });

  it("sends retry-after only with the 429", async () => {
    expect((await post("error-429")).headers["retry-after"]).toBe(String(RETRY_AFTER_SECONDS));
    expect((await post("error-529")).headers["retry-after"]).toBeUndefined();
  });

  it("fails before streaming, with a plain JSON body", async () => {
    const res = await request(createApp(config()).app)
      .post("/anthropic/v1/messages")
      .set("X-Mock-Scenario", "error-529")
      .send({ messages, stream: true });
    expect(res.status).toBe(529);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

describe("OpenAI error scenarios", () => {
  const post = (scenario: string) =>
    request(createApp(config()).app).post("/openai/v1/chat/completions").set("X-Mock-Scenario", scenario).send({ messages });

  it.each([
    [401, "invalid_request_error", "invalid_api_key"],
    [429, "requests", "rate_limit_exceeded"],
    [500, "server_error", null],
    [503, "server_error", null],
  ])("error-%i answers with the OpenAI error body", async (status, type, code) => {
    const res = await post(`error-${status}`);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: { message: expect.any(String), type, param: null, code } });
    expect(res.headers["x-request-id"]).toMatch(/^req_/);
  });

  it("sends retry-after with the 429", async () => {
    expect((await post("error-429")).headers["retry-after"]).toBe(String(RETRY_AFTER_SECONDS));
  });

  it("has no 529, which only Anthropic uses", async () => {
    expect((await post("error-529")).status).toBe(400);
  });
});

describe("drop", () => {
  let server: ReturnType<ReturnType<typeof createApp>["app"]["listen"]>;
  let base: string;
  beforeEach(async () => {
    server = createApp(config()).app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(() => {
    server.closeAllConnections();
    server.close();
  });

  const read = async (path: string, body: object) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-scenario": "drop" },
      body: JSON.stringify({ messages, stream: true, ...body }),
    });
    let text = "";
    let failed = false;
    try {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } catch {
      failed = true;
    }
    return { text, failed };
  };

  it("closes the Anthropic stream halfway, without message_stop", async () => {
    const { text, failed } = await read("/anthropic/v1/messages", {});
    expect(failed).toBe(true);
    expect(text).toContain("event: message_start");
    expect(text.match(/text_delta/g)).toHaveLength(5);
    expect(text).not.toContain("message_stop");
  });

  it("closes the OpenAI stream halfway, without finish_reason or [DONE]", async () => {
    const { text, failed } = await read("/openai/v1/chat/completions", {});
    expect(failed).toBe(true);
    expect(text.match(/"content"/g)).toHaveLength(5);
    expect(text).not.toContain("[DONE]");
    expect(text).not.toContain('"finish_reason":"stop"');
  });

  it("closes the connection of a non-streaming request too", async () => {
    await expect(
      fetch(`${base}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-scenario": "drop" },
        body: JSON.stringify({ messages }),
      }),
    ).rejects.toThrow();
  });
});

describe("slow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delays the first token by TTFT_MS plus the slow delay, then goes at the normal pace", async () => {
    const stream = streamScenarioText("slow", { config: config({ TTFT_MS: "100", TOKEN_INTERVAL_MS: "10" }) });
    let arrived = false;
    const first = stream.next().then((r) => {
      arrived = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(100 + SLOW_FIRST_TOKEN_MS - 1);
    expect(arrived).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await first).done).toBe(false);
    expect(arrived).toBe(true);
  });

  it("serves the normal scenario without the extra delay", async () => {
    const stream = streamScenarioText("ok", { config: config({ TTFT_MS: "100" }) });
    const first = stream.next();
    await vi.advanceTimersByTimeAsync(100);
    expect((await first).done).toBe(false);
  });
});
